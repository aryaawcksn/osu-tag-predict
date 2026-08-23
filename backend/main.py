import asyncio
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, UploadFile, File, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select

import predictor
from analysis import (
    BeatmapScore,
    DominantPlaystyle,
    calculate_dominant_playstyle,
    fetch_recent_plays,
    fetch_top_plays,
)
from auth import router as auth_router
from database import AsyncSessionFactory, engine
from dependencies import require_user
from models import Session, User
from queue_manager import queue_manager

MODEL_PATH = os.environ.get("MODEL_PATH", "model_lstm_osu_dataset_vXIII.keras")
MLB_PATH   = os.environ.get("MLB_PATH",   "pickle_mlb_VXIII.pkl")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise DB connection pool (validates connectivity on startup)
    async with engine.begin() as conn:
        print("DB connection established")
        _ = conn  # just ensuring pool is warm

    predictor.load_artifacts(MODEL_PATH, MLB_PATH)
    print(f"Model loaded: {MODEL_PATH}")
    try:
        await queue_manager.restore_from_db()
        print("Queue state restored from DB")
    except Exception as exc:
        print(f"Warning: could not restore queue from DB: {exc}")
    yield
    # Dispose engine on shutdown to close all pooled connections
    await engine.dispose()


app = FastAPI(title="osu! Playstyle Predictor", lifespan=lifespan)

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-Session-Token", "Authorization", "Content-Type"],
)

# Auth router (Requirements: 2.1, 2.2, 2.3, 2.5, 2.6)
app.include_router(auth_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Ensure CORS headers are present even on error responses."""
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


@app.options("/{full_path:path}")
def options_handler(full_path: str):
    return Response(status_code=200)


# --------------------------------------------------------------------------- #
# Pydantic schemas                                                              #
# --------------------------------------------------------------------------- #

class LinkRequest(BaseModel):
    url: str


class QueueJobResponse(BaseModel):
    job_id: str
    position: Optional[int]
    status: str


# --------------------------------------------------------------------------- #
# Helper: upsert beatmap after successful prediction (Requirement 4.5, 5.2)   #
# --------------------------------------------------------------------------- #

async def _upsert_beatmap_safe(result: dict) -> None:
    """
    Store prediction result in beatmaps table.
    Silently skips if beatmap_id is missing or DB write fails.
    Requirements: 4.5, 5.2
    """
    if "beatmap_id" not in result:
        return
    try:
        from recommendation import upsert_beatmap
        await upsert_beatmap(result)
    except Exception as exc:
        print(f"Warning: upsert_beatmap failed for {result.get('beatmap_id')}: {exc}")


# --------------------------------------------------------------------------- #
# Background task coroutines                                                    #
# --------------------------------------------------------------------------- #

async def _predict_link_task(input_value: str) -> dict:
    """Run predict_from_link in a thread pool to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, predictor.predict_from_link, input_value)
    await _upsert_beatmap_safe(result)
    return result


async def _predict_file_task(input_value: str) -> dict:
    """Run predict_from_file in a thread pool; input_value is a temp file path."""
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, predictor.predict_from_file, input_value)
        await _upsert_beatmap_safe(result)
        return result
    finally:
        try:
            os.unlink(input_value)
        except OSError:
            pass


# --------------------------------------------------------------------------- #
# Health                                                                        #
# --------------------------------------------------------------------------- #

@app.get("/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Predict endpoints (queue-aware)                                               #
# Requirements: 1.2, 1.3, 6.1                                                  #
# --------------------------------------------------------------------------- #

@app.post("/predict/link", response_model=QueueJobResponse)
async def predict_link(req: LinkRequest):
    """
    Submit a beatmap link for prediction via the queue.
    Returns job_id and position instead of the result directly.
    Requirements: 1.2, 1.3, 6.1
    """
    try:
        job = await queue_manager.enqueue(
            input_type="link",
            input_value=req.url,
            user_id=None,
            task_fn=_predict_link_task,
        )
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return QueueJobResponse(job_id=job.id, position=job.position, status=job.status)


@app.post("/predict/upload", response_model=QueueJobResponse)
async def predict_upload(file: UploadFile = File(...)):
    """
    Submit a .osu file upload for prediction via the queue.
    Returns job_id and position instead of the result directly.
    Requirements: 1.2, 1.3, 6.1
    """
    if not file.filename.endswith(".osu"):
        raise HTTPException(status_code=400, detail="Hanya file .osu yang diterima.")

    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".osu", delete=False, mode="wb") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        job = await queue_manager.enqueue(
            input_type="upload",
            input_value=tmp_path,
            user_id=None,
            task_fn=_predict_file_task,
        )
    except ValueError as e:
        # tmp file cleanup: since _predict_file_task won't run, clean up here
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return QueueJobResponse(job_id=job.id, position=job.position, status=job.status)


# --------------------------------------------------------------------------- #
# Queue endpoints                                                               #
# Requirements: 1.1, 1.6                                                        #
# --------------------------------------------------------------------------- #

@app.get("/queue/state")
def get_queue_state():
    """
    Return current queue state: occupied slots, total capacity, active jobs.
    Requirements: 1.1
    """
    state = queue_manager.get_queue_state()
    return {
        "total_capacity": state.total_capacity,
        "occupied_slots": state.occupied_slots,
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "position": j.position,
            }
            for j in state.jobs
        ],
    }


@app.get("/queue/job/{job_id}")
def get_job(job_id: str):
    """
    Return status and result of a specific job.
    Requirements: 1.6
    """
    job = queue_manager.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "id": job.id,
        "status": job.status,
        "position": job.position,
        "result": job.result,
        "error": job.error,
    }


# --------------------------------------------------------------------------- #
# Analysis endpoint                                                             #
# Requirements: 3.1, 3.2, 3.3, 3.6                                             #
# --------------------------------------------------------------------------- #

async def _get_access_token_for_user(user: User) -> str:
    """
    Retrieve a valid access token for the given user from their active session.
    Raises HTTP 401 if no valid session is found.
    Requirements: 2.6, 3.2
    """
    async with AsyncSessionFactory() as db:
        result = await db.execute(
            select(Session).where(Session.user_id == user.id)
            .order_by(Session.created_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(status_code=401, detail="No active session found")

    return session.access_token


@app.get("/analysis/playstyle", response_model=DominantPlaystyle)
async def analysis_playstyle(
    source: Literal["top", "recent"] = Query("top", description="Play history source: 'top' or 'recent'"),
    current_user: User = Depends(require_user),
):
    """
    Fetch play history, run predictions via queue, and return dominant playstyle.

    - source=top   : uses top plays (best scores)
    - source=recent: uses recent plays

    Batches beatmap submissions to stay within the 5-slot queue limit.
    Skips beatmaps that fail prediction (Requirement 3.6).

    Requirements: 3.1, 3.2, 3.3, 3.6
    """
    access_token = await _get_access_token_for_user(current_user)

    # Fetch play history from osu! API (Requirements 3.1, 3.2)
    try:
        if source == "top":
            plays: list[BeatmapScore] = await fetch_top_plays(current_user.osu_id, access_token)
        else:
            plays = await fetch_recent_plays(current_user.osu_id, access_token)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not plays:
        raise HTTPException(status_code=404, detail="No play history found")

    # Deduplicate beatmap IDs (a map may appear multiple times in history)
    seen: set[str] = set()
    unique_plays: list[BeatmapScore] = []
    for p in plays:
        if p.beatmap_id not in seen:
            seen.add(p.beatmap_id)
            unique_plays.append(p)

    # Check DB cache first — skip predict for beatmaps already predicted
    # with the current model version (Requirements 3.3, 3.6)
    from recommendation import get_cached_results
    all_ids = [p.beatmap_id for p in unique_plays]
    cached = await get_cached_results(all_ids)

    completed_results: list[dict] = list(cached.values())
    plays_to_predict = [p for p in unique_plays if p.beatmap_id not in cached]

    # Submit only uncached beatmaps to the queue in batches
    BATCH_SIZE = 5

    for batch_start in range(0, len(plays_to_predict), BATCH_SIZE):
        batch = plays_to_predict[batch_start: batch_start + BATCH_SIZE]
        job_ids: list[str] = []

        for play in batch:
            beatmap_url = f"https://osu.ppy.sh/beatmaps/{play.beatmap_id}"
            try:
                job = await queue_manager.enqueue(
                    input_type="link",
                    input_value=beatmap_url,
                    user_id=current_user.id,
                    task_fn=_predict_link_task,
                )
                job_ids.append(job.id)
            except ValueError:
                # Queue full — wait briefly and retry once, then skip
                await asyncio.sleep(1.0)
                try:
                    job = await queue_manager.enqueue(
                        input_type="link",
                        input_value=beatmap_url,
                        user_id=current_user.id,
                        task_fn=_predict_link_task,
                    )
                    job_ids.append(job.id)
                except ValueError:
                    # Still full — skip this beatmap (Requirement 3.6)
                    pass

        # Wait for all jobs in this batch to finish (done or failed)
        POLL_INTERVAL = 0.5
        MAX_WAIT = 120  # seconds per batch
        waited = 0.0
        while waited < MAX_WAIT:
            all_done = all(
                queue_manager.get_job(jid) is not None
                and queue_manager.get_job(jid).status in ("done", "failed")
                for jid in job_ids
            )
            if all_done:
                break
            await asyncio.sleep(POLL_INTERVAL)
            waited += POLL_INTERVAL

        # Collect successful results; skip failed ones (Requirement 3.6)
        for jid in job_ids:
            job = queue_manager.get_job(jid)
            if job and job.status == "done" and job.result:
                completed_results.append(job.result)

    if not completed_results:
        raise HTTPException(
            status_code=422,
            detail="All beatmap predictions failed. Cannot determine playstyle.",
        )

    # Calculate dominant playstyle (Requirement 3.4)
    dominant = calculate_dominant_playstyle(completed_results)
    return dominant


# --------------------------------------------------------------------------- #
# Recommendation endpoint                                                       #
# Requirements: 4.1, 4.6                                                        #
# --------------------------------------------------------------------------- #

@app.get("/recommend")
async def recommend(
    playstyle: str = Query(..., description="Dominant playstyle label to get recommendations for"),
    min_stars: Optional[float] = Query(None, description="Minimum difficulty rating"),
    max_stars: Optional[float] = Query(None, description="Maximum difficulty rating"),
    current_user: User = Depends(require_user),
):
    """
    Return beatmap recommendations matching the given playstyle label.
    Optionally filter by difficulty range (min_stars, max_stars).
    Requirements: 4.1, 4.6
    """
    from recommendation import get_recommendations
    results = await get_recommendations(playstyle, min_stars=min_stars, max_stars=max_stars)
    if not results:
        return {"recommendations": [], "message": f"No recommendations available for playstyle '{playstyle}' yet."}
    return {"recommendations": results}


@app.get("/beatmaps/by-tags")
async def beatmaps_by_tags(
    tags: str = Query(..., description="Comma-separated list of playstyle tags"),
    min_stars: Optional[float] = Query(None),
    max_stars: Optional[float] = Query(None),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_user),
):
    """
    Return beatmaps matching ALL of the given tags, sorted by avg tag probability.
    Supports pagination via offset.
    """
    from recommendation import get_beatmaps_by_tags
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    if not tag_list:
        raise HTTPException(status_code=400, detail="At least one tag required")
    results = await get_beatmaps_by_tags(tag_list, offset=offset, min_stars=min_stars, max_stars=max_stars)
    return {"beatmaps": results, "tags": tag_list, "offset": offset, "has_more": len(results) == 20}


# --------------------------------------------------------------------------- #
# Admin endpoint                                                                #
# Requirements: 5.4                                                             #
# --------------------------------------------------------------------------- #

class AdminBeatmapRequest(BaseModel):
    beatmap_id: str
    bpm: Optional[float] = None
    ar: Optional[float] = None
    cs: Optional[float] = None
    od: Optional[float] = None
    object_count: Optional[int] = None
    predicted_labels: list[dict] = []


@app.post("/admin/beatmap", status_code=200)
async def admin_upsert_beatmap(
    payload: AdminBeatmapRequest,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
):
    """
    Manually insert or update a beatmap record with playstyle labels.
    Protected by X-Admin-Key header matching ADMIN_KEY env var.
    Requirements: 5.4
    """
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")

    from recommendation import upsert_beatmap
    record = await upsert_beatmap(payload.model_dump())
    return {"status": "ok", "beatmap": record}
