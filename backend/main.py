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
from dependencies import require_user, get_current_user
from models import Session, User
from queue_manager import queue_manager

MODEL_PATH = os.environ.get("MODEL_PATH", "model_lstm_osu_dataset_16.keras")
MLB_PATH   = os.environ.get("MLB_PATH",   "pickle_mlb_16.pkl")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise DB connection pool (validates connectivity on startup and ensures tables)
    async with engine.begin() as conn:
        print("DB connection established")
        from database import Base
        await conn.run_sync(Base.metadata.create_all)


    predictor.load_artifacts(MODEL_PATH, MLB_PATH)
    print(f"Model loaded: {MODEL_PATH}")
    try:
        await queue_manager.restore_from_db()
        print("Queue state restored from DB")
    except Exception as exc:
        print(f"Warning: could not restore queue from DB: {exc}")

    # Start daily beatmap crawler in background (non-blocking)
    from crawler import start_daily_crawler
    crawler_task = asyncio.create_task(start_daily_crawler())

    yield

    crawler_task.cancel()
    try:
        await crawler_task
    except asyncio.CancelledError:
        pass
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
    if origin in ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Session-Token, X-Admin-Key"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Ensure CORS headers are present on unexpected 500 errors too."""
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Session-Token, X-Admin-Key"
    import traceback
    print(f"Unhandled exception on {request.method} {request.url}: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )


# NOTE: Do NOT add a manual @app.options handler — CORSMiddleware handles preflight.
# A manual OPTIONS route would intercept before middleware and strip CORS headers.


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
    """Run predict_from_file in a thread pool; input_value is a temp file path.
    File uploads are NOT saved to DB — they have no beatmap_id."""
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, predictor.predict_from_file, input_value)
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


@app.get("/stats")
async def get_stats():
    """Public endpoint: total users and total beatmaps processed."""
    from sqlalchemy import func as sqlfunc
    from models import User as UserModel, Beatmap as BeatmapModel
    async with AsyncSessionFactory() as db:
        total_users = (await db.execute(
            select(sqlfunc.count()).select_from(UserModel)
        )).scalar_one()
        total_beatmaps = (await db.execute(
            select(sqlfunc.count()).select_from(BeatmapModel)
        )).scalar_one()
    return {"total_users": total_users, "total_beatmaps": total_beatmaps}


# --------------------------------------------------------------------------- #
# Beatmapset download proxy                                                     #
# osu! /beatmapsets/{id}/download requires session cookie we can't forward.    #
# We proxy via app token so the browser gets the .osz directly.                #
# --------------------------------------------------------------------------- #

@app.get("/proxy/download/{beatmapset_id}")
async def proxy_download(
    beatmapset_id: str,
    title: Optional[str] = Query(None),
    artist: Optional[str] = Query(None),
):
    """
    Proxy .osz download via public mirrors (no auth required).
    Tries chimu.moe first, falls back to beatconnect.
    """
    import httpx
    import re as _re
    from fastapi.responses import StreamingResponse

    mirrors = [
        f"https://chimu.moe/d/{beatmapset_id}",
        f"https://beatconnect.io/b/{beatmapset_id}",
    ]

    client = httpx.AsyncClient(follow_redirects=True, timeout=60)
    resp = None

    for url in mirrors:
        try:
            req = client.build_request("GET", url)
            r = await client.send(req, stream=True)
            if r.status_code == 200:
                resp = r
                break
            await r.aclose()
        except Exception:
            continue

    if resp is None:
        await client.aclose()
        raise HTTPException(
            status_code=502,
            detail="All download mirrors failed. Try downloading directly from osu! website.",
        )

    async def stream_and_close():
        try:
            async for chunk in resp.aiter_bytes(65536):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    # Build a clean filename: "artist - title (id).osz"
    def _safe(s: str) -> str:
        return _re.sub(r'[\\/*?:"<>|]', "", s).strip()[:80]

    if title and artist:
        fname = f"{_safe(artist)} - {_safe(title)} ({beatmapset_id}).osz"
    elif title:
        fname = f"{_safe(title)} ({beatmapset_id}).osz"
    else:
        fname = f"{beatmapset_id}.osz"

    headers = {"Content-Disposition": f'attachment; filename="{fname}"'}
    if "content-length" in resp.headers:
        headers["Content-Length"] = resp.headers["content-length"]

    return StreamingResponse(
        stream_and_close(),
        media_type="application/x-osu-beatmap-archive",
        headers=headers,
    )


@app.get("/crawler/status")
async def crawler_status(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
):
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")
    from crawler import get_crawler_status
    return get_crawler_status()


@app.post("/crawler/run", status_code=200)
async def crawler_run_now(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
):
    """Manually trigger a daily crawler run (admin only)."""
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")
    from crawler import run_crawl
    asyncio.create_task(run_crawl())
    return {"ok": True, "message": "Crawler run started in background"}


@app.post("/crawler/run-weekly", status_code=200)
async def crawler_run_weekly(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
):
    """Manually trigger a weekly crawler run to fetch beatmaps ranked in the last 7 days (admin only)."""
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")
    from crawler import run_weekly
    asyncio.create_task(run_weekly())
    return {"ok": True, "message": "Weekly crawler run started in background"}


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
    dominant = calculate_dominant_playstyle(completed_results, plays=unique_plays)
    return dominant


# --------------------------------------------------------------------------- #
# Recommendation endpoint                                                       #
# Requirements: 4.1, 4.6                                                        #
# --------------------------------------------------------------------------- #

@app.get("/recommend")
async def recommend(
    playstyle: str = Query(...),
    min_stars: Optional[float] = Query(None),
    max_stars: Optional[float] = Query(None),
    status: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    randomize: bool = Query(False),
    current_user: User = Depends(require_user),
):
    import random as _random
    from recommendation import get_recommendations, get_hidden_ids
    hidden = await get_hidden_ids(current_user.id)
    results = await get_recommendations(
        playstyle, min_stars=min_stars, max_stars=max_stars,
        status=status, exclude_ids=hidden, offset=offset,
    )
    if randomize and results:
        _random.shuffle(results)
    has_more = len(results) == 10
    if not results and offset == 0:
        return {"recommendations": [], "has_more": False, "message": f"No recommendations available for playstyle '{playstyle}' yet."}
    return {"recommendations": results, "has_more": has_more}


# --------------------------------------------------------------------------- #
# Hidden beatmaps endpoints                                                     #
# --------------------------------------------------------------------------- #

# NOTE: specific routes MUST come before parametric /{beatmap_id} routes

@app.get("/hidden")
async def list_hidden(current_user: User = Depends(require_user)):
    from models import HiddenBeatmap, HiddenBeatmapset
    from recommendation import _build_records
    async with AsyncSessionFactory() as db:
        indiv_rows = list((await db.execute(
            select(HiddenBeatmap).where(HiddenBeatmap.user_id == current_user.id)
            .order_by(HiddenBeatmap.hidden_at.desc())
        )).scalars().all())
        set_rows = list((await db.execute(
            select(HiddenBeatmapset).where(HiddenBeatmapset.user_id == current_user.id)
            .order_by(HiddenBeatmapset.hidden_at.desc())
        )).scalars().all())

    hidden_beatmap_ids = [r.beatmap_id for r in indiv_rows]
    hidden_set_ids = [r.beatmapset_id for r in set_rows]

    set_beatmap_ids: list[str] = []
    if hidden_set_ids:
        from models import Beatmap as BeatmapModel
        async with AsyncSessionFactory() as db:
            set_beatmap_ids = list((await db.execute(
                select(BeatmapModel.beatmap_id).where(BeatmapModel.beatmapset_id.in_(hidden_set_ids))
            )).scalars().all())

    all_hidden_ids = list(set(hidden_beatmap_ids + set_beatmap_ids))
    if not all_hidden_ids:
        return {"hidden": [], "hidden_sets": hidden_set_ids}

    from models import Beatmap as BeatmapModel
    async with AsyncSessionFactory() as db:
        beatmaps = list((await db.execute(
            select(BeatmapModel).where(BeatmapModel.beatmap_id.in_(all_hidden_ids))
        )).scalars().all())
    records = await _build_records(beatmaps)

    for r in records:
        bm_setid = r.get("beatmapset_id")
        r["hidden_by"] = "set" if (bm_setid and bm_setid in hidden_set_ids) else "beatmap"

    return {"hidden": records, "hidden_sets": hidden_set_ids}


@app.post("/hidden/set/{beatmapset_id}", status_code=200)
async def hide_beatmapset(beatmapset_id: str, current_user: User = Depends(require_user)):
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import HiddenBeatmapset
    async with AsyncSessionFactory() as db:
        async with db.begin():
            stmt = pg_insert(HiddenBeatmapset).values(
                user_id=current_user.id, beatmapset_id=beatmapset_id
            ).on_conflict_do_nothing()
            await db.execute(stmt)
    return {"ok": True, "beatmapset_id": beatmapset_id}


@app.delete("/hidden/set/{beatmapset_id}", status_code=200)
async def unhide_beatmapset(beatmapset_id: str, current_user: User = Depends(require_user)):
    from sqlalchemy import delete
    from models import HiddenBeatmap, HiddenBeatmapset, Beatmap as BeatmapModel
    async with AsyncSessionFactory() as db:
        async with db.begin():
            await db.execute(
                delete(HiddenBeatmapset).where(
                    HiddenBeatmapset.user_id == current_user.id,
                    HiddenBeatmapset.beatmapset_id == beatmapset_id,
                )
            )
            # Also clear any individual hidden_beatmaps for diffs in this set
            set_beatmap_ids = list((await db.execute(
                select(BeatmapModel.beatmap_id)
                .where(BeatmapModel.beatmapset_id == beatmapset_id)
            )).scalars().all())
            if set_beatmap_ids:
                await db.execute(
                    delete(HiddenBeatmap).where(
                        HiddenBeatmap.user_id == current_user.id,
                        HiddenBeatmap.beatmap_id.in_(set_beatmap_ids),
                    )
                )
    return {"ok": True, "beatmapset_id": beatmapset_id}


@app.post("/hidden/multi-unhide", status_code=200)
async def multi_unhide(
    payload: dict,
    current_user: User = Depends(require_user),
):
    """Unhide multiple beatmaps and/or beatmapsets at once."""
    from sqlalchemy import delete
    from models import HiddenBeatmap, HiddenBeatmapset, Beatmap as BeatmapModel
    beatmap_ids: list[str] = payload.get("beatmap_ids", [])
    beatmapset_ids: list[str] = payload.get("beatmapset_ids", [])
    async with AsyncSessionFactory() as db:
        async with db.begin():
            if beatmap_ids:
                await db.execute(
                    delete(HiddenBeatmap).where(
                        HiddenBeatmap.user_id == current_user.id,
                        HiddenBeatmap.beatmap_id.in_(beatmap_ids),
                    )
                )
            if beatmapset_ids:
                await db.execute(
                    delete(HiddenBeatmapset).where(
                        HiddenBeatmapset.user_id == current_user.id,
                        HiddenBeatmapset.beatmapset_id.in_(beatmapset_ids),
                    )
                )
                # Also remove any individual hidden_beatmaps entries that belong
                # to these beatmapsets (handles the double-hide case)
                set_beatmap_ids = list((await db.execute(
                    select(BeatmapModel.beatmap_id)
                    .where(BeatmapModel.beatmapset_id.in_(beatmapset_ids))
                )).scalars().all())
                if set_beatmap_ids:
                    await db.execute(
                        delete(HiddenBeatmap).where(
                            HiddenBeatmap.user_id == current_user.id,
                            HiddenBeatmap.beatmap_id.in_(set_beatmap_ids),
                        )
                    )
    return {"ok": True}


@app.post("/hidden/{beatmap_id}", status_code=200)
async def hide_beatmap(beatmap_id: str, current_user: User = Depends(require_user)):
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import HiddenBeatmap
    async with AsyncSessionFactory() as db:
        async with db.begin():
            stmt = pg_insert(HiddenBeatmap).values(
                user_id=current_user.id, beatmap_id=beatmap_id
            ).on_conflict_do_nothing()
            await db.execute(stmt)
    return {"ok": True, "beatmap_id": beatmap_id}


@app.delete("/hidden/{beatmap_id}", status_code=200)
async def unhide_beatmap_single(beatmap_id: str, current_user: User = Depends(require_user)):
    from sqlalchemy import delete
    from models import HiddenBeatmap
    async with AsyncSessionFactory() as db:
        async with db.begin():
            await db.execute(
                delete(HiddenBeatmap).where(
                    HiddenBeatmap.user_id == current_user.id,
                    HiddenBeatmap.beatmap_id == beatmap_id,
                )
            )
    return {"ok": True, "beatmap_id": beatmap_id}


@app.delete("/admin/beatmaps/no-set", status_code=200)
async def delete_beatmaps_without_set(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
):
    """Delete all beatmaps that have no beatmapset_id (orphaned records)."""
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")
    from sqlalchemy import delete as sa_delete
    from models import Beatmap as BeatmapModel
    async with AsyncSessionFactory() as db:
        async with db.begin():
            result = await db.execute(
                sa_delete(BeatmapModel).where(BeatmapModel.beatmapset_id.is_(None))
            )
    return {"ok": True, "deleted": result.rowcount}


@app.get("/beatmaps/this-week")
async def beatmaps_this_week():
    """
    Return beatmapsets ranked in the current week (Mon–Sun), grouped by beatmapset_id.
    Each group contains all difficulties, sorted by difficulty_rating asc.
    No auth required — shown on landing page.
    """
    from datetime import date, timedelta
    from sqlalchemy import select as sa_select
    from models import Beatmap as BeatmapModel, BeatmapLabel as BeatmapLabelModel
    from recommendation import _build_records

    today = date.today()
    week_start = today - timedelta(days=6)  # rolling last 7 days
    week_end = today

    async with AsyncSessionFactory() as db:
        rows = list((await db.execute(
            sa_select(BeatmapModel).where(
                BeatmapModel.ranked_date >= week_start.isoformat(),
                BeatmapModel.ranked_date <= week_end.isoformat() + "T23:59:59",
                BeatmapModel.status.in_(["ranked", "loved", "approved", "qualified"]),
                BeatmapModel.beatmapset_id.isnot(None),
            ).order_by(BeatmapModel.ranked_date.desc())
        )).scalars().all())

    # Fallback: expand to 30 days if no results in last 7
    if not rows:
        week_start = today - timedelta(days=29)
        async with AsyncSessionFactory() as db:
            rows = list((await db.execute(
                sa_select(BeatmapModel).where(
                    BeatmapModel.ranked_date >= week_start.isoformat(),
                    BeatmapModel.ranked_date <= week_end.isoformat() + "T23:59:59",
                    BeatmapModel.status.in_(["ranked", "loved", "approved", "qualified"]),
                    BeatmapModel.beatmapset_id.isnot(None),
                ).order_by(BeatmapModel.ranked_date.desc()).limit(200)
            )).scalars().all())

    # Group by beatmapset_id
    from collections import defaultdict
    sets: dict[str, list] = defaultdict(list)
    for bm in rows:
        sets[bm.beatmapset_id].append(bm)

    # Sort diffs within each set by difficulty_rating asc
    for diffs in sets.values():
        diffs.sort(key=lambda b: b.difficulty_rating or 0)

    # Build records for all beatmaps then regroup
    all_bms = [bm for diffs in sets.values() for bm in diffs]
    all_records = await _build_records(all_bms)
    record_map = {r["beatmap_id"]: r for r in all_records}

    beatmapsets = []
    for set_id, diffs in sets.items():
        diff_records = [record_map[bm.beatmap_id] for bm in diffs if bm.beatmap_id in record_map]
        if not diff_records:
            continue
        # Representative diff = highest rated
        rep = max(diff_records, key=lambda r: r["difficulty_rating"] or 0)
        beatmapsets.append({
            "beatmapset_id": set_id,
            "title": rep["title"],
            "artist": rep["artist"],
            "cover_url": rep["cover_url"],
            "card_url": rep["card_url"],
            "status": rep["status"],
            "ranked_date": rep["ranked_date"],
            "difficulties": diff_records,
        })

    # Sort sets: loved first, then ranked/approved, then by ranked_date desc
    status_order = {"loved": 0, "ranked": 1, "approved": 1, "qualified": 2}
    beatmapsets.sort(key=lambda s: (
        status_order.get(s["status"] or "", 9),
        s.get("ranked_date") or "",
    ), reverse=True)

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "is_fallback": (today - week_start).days > 6,
        "beatmapsets": beatmapsets,
    }


@app.get("/beatmaps/by-tags")
async def beatmaps_by_tags(
    tags: str = Query(...),
    min_stars: Optional[float] = Query(None),
    max_stars: Optional[float] = Query(None),
    status: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    current_user: User = Depends(require_user),
):
    from recommendation import get_beatmaps_by_tags
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    if not tag_list:
        raise HTTPException(status_code=400, detail="At least one tag required")
    results = await get_beatmaps_by_tags(
        tag_list, offset=offset, min_stars=min_stars, max_stars=max_stars,
        status=status, year_from=year_from, year_to=year_to,
    )
    return {"beatmaps": results, "tags": tag_list, "offset": offset, "has_more": len(results) == 20}


class VoteTagsRequest(BaseModel):
    tags: list[str]


class RelevanceRequest(BaseModel):
    labels: list[dict]  # [{"label": str, "probability": float}]


@app.post("/beatmaps/by-relevance")
async def beatmaps_by_relevance(
    payload: RelevanceRequest,
    offset: int = Query(0, ge=0),
    min_stars: Optional[float] = Query(None),
    max_stars: Optional[float] = Query(None),
    current_user: User = Depends(require_user),
):
    """Find beatmaps most similar to a given label vector (sorted by cosine similarity)."""
    if not payload.labels:
        raise HTTPException(status_code=400, detail="labels required")
    from recommendation import get_beatmaps_by_relevance, get_hidden_ids
    hidden = await get_hidden_ids(current_user.id)
    results = await get_beatmaps_by_relevance(
        source_labels=payload.labels,
        offset=offset,
        exclude_ids=hidden,
        min_stars=min_stars,
        max_stars=max_stars,
    )
    return {"beatmaps": results, "has_more": len(results) == 20}




@app.post("/beatmaps/{beatmap_id}/vote-tags", status_code=200)
async def vote_beatmap_tags(
    beatmap_id: str,
    payload: VoteTagsRequest,
    current_user: User = Depends(require_user),
):
    """
    Allow authenticated user to vote on tags for a beatmap ("Help find the right tags").
    A user can vote for multiple tags, but each unique tag gets 1 vote per user.
    """
    clean_tags = [t.strip() for t in payload.tags if t.strip()]
    if not clean_tags:
        raise HTTPException(status_code=400, detail="At least one tag must be selected")

    from models import BeatmapTagVote
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    async with AsyncSessionFactory() as db:
        async with db.begin():
            for tag in clean_tags:
                stmt = pg_insert(BeatmapTagVote).values(
                    user_id=current_user.id,
                    beatmap_id=beatmap_id,
                    tag=tag,
                ).on_conflict_do_nothing()
                await db.execute(stmt)

    return {"ok": True, "beatmap_id": beatmap_id, "voted_tags": clean_tags}


@app.get("/beatmaps/{beatmap_id}/user-votes", status_code=200)
async def get_user_beatmap_votes(
    beatmap_id: str,
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get all tag vote counts for this beatmap and the current user's voted tags."""
    from models import BeatmapTagVote
    from sqlalchemy import func as sqlfunc
    async with AsyncSessionFactory() as db:
        # Total votes count per tag across all users
        stmt_counts = (
            select(BeatmapTagVote.tag, sqlfunc.count(BeatmapTagVote.id).label("count"))
            .where(BeatmapTagVote.beatmap_id == beatmap_id)
            .group_by(BeatmapTagVote.tag)
        )
        rows = (await db.execute(stmt_counts)).all()
        tag_counts = {r.tag: r.count for r in rows}

        # Current user's own voted tags (if logged in)
        voted_tags = []
        if current_user:
            stmt_user = select(BeatmapTagVote.tag).where(
                BeatmapTagVote.beatmap_id == beatmap_id,
                BeatmapTagVote.user_id == current_user.id,
            )
            voted_tags = list((await db.execute(stmt_user)).scalars().all())

    return {
        "beatmap_id": beatmap_id,
        "tag_counts": tag_counts,
        "voted_tags": voted_tags,
    }



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


# --------------------------------------------------------------------------- #
# Re-label: re-predict all beatmaps in DB with the current model               #
# --------------------------------------------------------------------------- #

_relabel_state: dict = {
    "running": False,
    "total": 0,
    "done": 0,
    "failed": 0,
    "started_at": None,
}


@app.get("/relabel/status")
def relabel_status():
    """Public endpoint: current re-label progress."""
    return _relabel_state


@app.post("/relabel/start", status_code=202)
async def relabel_start(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
):
    """Start background re-labeling of all beatmaps not on current model version."""
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")
    if _relabel_state["running"]:
        raise HTTPException(status_code=409, detail="Re-label already running")
    asyncio.create_task(_run_relabel())
    return {"ok": True, "message": "Re-label started"}


async def _run_relabel():
    from sqlalchemy import select as sa_select
    from models import Beatmap as BeatmapModel
    from recommendation import MODEL_VERSION, upsert_beatmap

    global _relabel_state
    _relabel_state.update(running=True, done=0, failed=0,
                          started_at=__import__("datetime").datetime.utcnow().isoformat())

    async with AsyncSessionFactory() as db:
        ids = list((await db.execute(
            sa_select(BeatmapModel.beatmap_id).where(
                (BeatmapModel.model_version != MODEL_VERSION) |
                BeatmapModel.model_version.is_(None)
            )
        )).scalars().all())

    _relabel_state["total"] = len(ids)

    loop = asyncio.get_event_loop()
    CONCURRENCY = 2
    sem = asyncio.Semaphore(CONCURRENCY)

    async def _process(beatmap_id: str):
        async with sem:
            try:
                result = await loop.run_in_executor(
                    None, predictor.predict_from_link,
                    f"https://osu.ppy.sh/beatmaps/{beatmap_id}",
                )
                result["beatmap_id"] = beatmap_id
                await upsert_beatmap(result)
                _relabel_state["done"] += 1
            except Exception as exc:
                print(f"Re-label failed for {beatmap_id}: {exc}")
                _relabel_state["failed"] += 1
            await asyncio.sleep(0.5)

    await asyncio.gather(*[_process(bid) for bid in ids])
    _relabel_state["running"] = False


# --------------------------------------------------------------------------- #
# Playlist endpoints                                                            #
# --------------------------------------------------------------------------- #

class PlaylistCreate(BaseModel):
    name: str
    is_public: bool = False


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    is_public: Optional[bool] = None


async def _build_playlist_response(playlist, include_items: bool = True, current_user_id: Optional[int] = None) -> dict:
    """Serialize a Playlist ORM object to a dict, optionally with beatmap records."""
    from recommendation import _build_records
    from models import Beatmap as BeatmapModel

    items_data = []
    if include_items and playlist.items:
        beatmap_ids = [item.beatmap_id for item in playlist.items]
        async with AsyncSessionFactory() as db:
            bms = list((await db.execute(
                select(BeatmapModel).where(BeatmapModel.beatmap_id.in_(beatmap_ids))
            )).scalars().all())
        records = await _build_records(bms)
        record_map = {r["beatmap_id"]: r for r in records}
        for item in playlist.items:
            if item.beatmap_id in record_map:
                items_data.append(record_map[item.beatmap_id])

    # Compute top 3 tags across all beatmaps in playlist
    from collections import Counter
    tag_counter: Counter = Counter()
    for item_rec in items_data:
        for lbl in item_rec.get("labels", []):
            tag_counter[lbl["label"]] += lbl["probability"]
    top_tags = [t for t, _ in tag_counter.most_common(12)]

    # Cover previews: up to 4 card_url from items
    covers = [r["card_url"] or r["cover_url"] for r in items_data if r.get("card_url") or r.get("cover_url")][:4]

    # Snapshot hash: deterministic hash of sorted beatmap IDs (detects content changes)
    import hashlib
    sorted_ids = sorted(item.beatmap_id for item in playlist.items)
    snapshot_hash = hashlib.md5(",".join(sorted_ids).encode()).hexdigest() if sorted_ids else ""

    # Difficulty distribution — one bucket per integer star rating, 1–10+
    diff_buckets = [
        {"range": "1", "label": "1★",  "min": 0.5, "max": 1.5,  "color": "#4FC0FF"},
        {"range": "2", "label": "2★",  "min": 1.5, "max": 2.5,  "color": "#4FFFD5"},
        {"range": "3", "label": "3★",  "min": 2.5, "max": 3.5,  "color": "#7CFF4F"},
        {"range": "4", "label": "4★",  "min": 3.5, "max": 4.5,  "color": "#F6F05C"},
        {"range": "5", "label": "5★",  "min": 4.5, "max": 5.5,  "color": "#FF8068"},
        {"range": "6", "label": "6★",  "min": 5.5, "max": 6.5,  "color": "#FF4E6F"},
        {"range": "7", "label": "7★",  "min": 6.5, "max": 7.5,  "color": "#C645B8"},
        {"range": "8", "label": "8★",  "min": 7.5, "max": 8.5,  "color": "#6563DE"},
        {"range": "9", "label": "9★",  "min": 8.5, "max": 9.5,  "color": "#18158E"},
        {"range": "10+","label": "10+★","min": 9.5, "max": 99,   "color": "#aaaaaa"},
    ]
    diff_distribution = []
    for bucket in diff_buckets:
        count = sum(
            1 for r in items_data
            if r.get("difficulty_rating") is not None
            and bucket["min"] <= (r["difficulty_rating"] or 0) < bucket["max"]
        )
        diff_distribution.append({
            "range": bucket["label"],
            "count": count,
            "color": bucket["color"],
        })

    # Current user's love status
    loved = False
    love_snapshot_hash = None
    if current_user_id is not None:
        from models import PlaylistLove
        async with AsyncSessionFactory() as db:
            love_row = (await db.execute(
                select(PlaylistLove).where(
                    PlaylistLove.user_id == current_user_id,
                    PlaylistLove.playlist_id == playlist.id,
                )
            )).scalar_one_or_none()
            if love_row:
                loved = True
                love_snapshot_hash = love_row.snapshot_hash

    return {
        "id": playlist.id,
        "name": playlist.name,
        "is_public": bool(playlist.is_public),
        "owner": {
            "username": playlist.user.username,
            "avatar_url": playlist.user.avatar_url,
            "osu_id": playlist.user.osu_id,
        },
        "item_count": len(playlist.items),
        "top_tags": top_tags,
        "covers": covers,
        "diff_distribution": diff_distribution,
        "beatmaps": items_data if include_items else [],
        "created_at": playlist.created_at.isoformat(),
        "updated_at": playlist.updated_at.isoformat(),
        "love_count": playlist.love_count if hasattr(playlist, "love_count") else 0,
        "snapshot_hash": snapshot_hash,
        "loved": loved,
        "love_snapshot_hash": love_snapshot_hash,
    }


@app.get("/playlists/public")
async def list_public_playlists(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, le=50),
    current_user: Optional[User] = Depends(get_current_user),
):
    """List all public playlists — visible to anyone on the homepage."""
    from models import Playlist as PlaylistModel
    from sqlalchemy.orm import selectinload
    async with AsyncSessionFactory() as db:
        rows = list((await db.execute(
            select(PlaylistModel)
            .where(PlaylistModel.is_public == 1)
            .options(selectinload(PlaylistModel.user), selectinload(PlaylistModel.items))
            .order_by(PlaylistModel.updated_at.desc())
            .offset(offset).limit(limit)
        )).scalars().all())

    uid = current_user.id if current_user else None
    result = []
    for pl in rows:
        result.append(await _build_playlist_response(pl, include_items=True, current_user_id=uid))
    return {"playlists": result, "has_more": len(rows) == limit}


@app.get("/playlists/user/{username}")
async def get_user_playlists(
    username: str,
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get all playlists for a user by username.
    Public playlists are visible to anyone; private ones only to the owner.
    """
    from models import Playlist as PlaylistModel
    from sqlalchemy.orm import selectinload
    async with AsyncSessionFactory() as db:
        owner = (await db.execute(
            select(User).where(User.username == username)
        )).scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="User not found")

    is_owner = current_user and current_user.id == owner.id
    async with AsyncSessionFactory() as db:
        q = select(PlaylistModel).where(PlaylistModel.user_id == owner.id)
        if not is_owner:
            q = q.where(PlaylistModel.is_public == 1)
        q = q.options(selectinload(PlaylistModel.user), selectinload(PlaylistModel.items))
        q = q.order_by(PlaylistModel.updated_at.desc())
        rows = list((await db.execute(q)).scalars().all())

    result = []
    for pl in rows:
        result.append(await _build_playlist_response(pl, include_items=True, current_user_id=current_user.id if current_user else None))

    return {
        "owner": {"username": owner.username, "avatar_url": owner.avatar_url, "osu_id": owner.osu_id},
        "playlists": result,
    }


@app.post("/playlists", status_code=201)
async def create_playlist(
    payload: PlaylistCreate,
    current_user: User = Depends(require_user),
):
    from models import Playlist as PlaylistModel
    from sqlalchemy.orm import selectinload
    from sqlalchemy import func as sqlfunc
    # Enforce max 3 playlists per user
    async with AsyncSessionFactory() as db:
        count = (await db.execute(
            select(sqlfunc.count()).select_from(PlaylistModel)
            .where(PlaylistModel.user_id == current_user.id)
        )).scalar_one()
    if count >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 playlists allowed per user")
    async with AsyncSessionFactory() as db:
        async with db.begin():
            pl = PlaylistModel(
                user_id=current_user.id,
                name=payload.name.strip()[:120],
                is_public=int(payload.is_public),
            )
            db.add(pl)
            await db.flush()
            pl_id = pl.id
    async with AsyncSessionFactory() as db:
        pl = (await db.execute(
            select(PlaylistModel).where(PlaylistModel.id == pl_id)
            .options(selectinload(PlaylistModel.user), selectinload(PlaylistModel.items))
        )).scalar_one()
    return await _build_playlist_response(pl)


@app.patch("/playlists/{playlist_id}", status_code=200)
async def update_playlist(
    playlist_id: int,
    payload: PlaylistUpdate,
    current_user: User = Depends(require_user),
):
    from models import Playlist as PlaylistModel
    from sqlalchemy.orm import selectinload
    async with AsyncSessionFactory() as db:
        async with db.begin():
            pl = (await db.execute(
                select(PlaylistModel).where(PlaylistModel.id == playlist_id)
            )).scalar_one_or_none()
            if not pl:
                raise HTTPException(status_code=404, detail="Playlist not found")
            if pl.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not your playlist")
            if payload.name is not None:
                pl.name = payload.name.strip()[:120]
            if payload.is_public is not None:
                pl.is_public = int(payload.is_public)
    async with AsyncSessionFactory() as db:
        pl = (await db.execute(
            select(PlaylistModel).where(PlaylistModel.id == playlist_id)
            .options(selectinload(PlaylistModel.user), selectinload(PlaylistModel.items))
        )).scalar_one()
    return await _build_playlist_response(pl)


@app.delete("/playlists/{playlist_id}", status_code=200)
async def delete_playlist(
    playlist_id: int,
    current_user: User = Depends(require_user),
):
    from models import Playlist as PlaylistModel
    from sqlalchemy import delete as sa_delete
    async with AsyncSessionFactory() as db:
        async with db.begin():
            pl = (await db.execute(
                select(PlaylistModel).where(PlaylistModel.id == playlist_id)
            )).scalar_one_or_none()
            if not pl:
                raise HTTPException(status_code=404, detail="Playlist not found")
            if pl.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not your playlist")
            await db.execute(sa_delete(PlaylistModel).where(PlaylistModel.id == playlist_id))
    return {"ok": True}


@app.post("/playlists/{playlist_id}/items/{beatmap_id}", status_code=200)
async def add_to_playlist(
    playlist_id: int,
    beatmap_id: str,
    current_user: User = Depends(require_user),
):
    from models import Playlist as PlaylistModel, PlaylistItem
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.orm import selectinload
    async with AsyncSessionFactory() as db:
        pl = (await db.execute(
            select(PlaylistModel).where(PlaylistModel.id == playlist_id)
        )).scalar_one_or_none()
        if not pl:
            raise HTTPException(status_code=404, detail="Playlist not found")
        if pl.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your playlist")
    async with AsyncSessionFactory() as db:
        async with db.begin():
            # Get current max position
            from sqlalchemy import func as sqlfunc
            max_pos = (await db.execute(
                select(sqlfunc.coalesce(sqlfunc.max(PlaylistItem.position), -1))
                .where(PlaylistItem.playlist_id == playlist_id)
            )).scalar_one()
            stmt = pg_insert(PlaylistItem).values(
                playlist_id=playlist_id,
                beatmap_id=beatmap_id,
                position=max_pos + 1,
            ).on_conflict_do_nothing()
            await db.execute(stmt)
    return {"ok": True, "playlist_id": playlist_id, "beatmap_id": beatmap_id}


@app.delete("/playlists/{playlist_id}/items/{beatmap_id}", status_code=200)
async def remove_from_playlist(
    playlist_id: int,
    beatmap_id: str,
    current_user: User = Depends(require_user),
):
    from models import Playlist as PlaylistModel, PlaylistItem
    from sqlalchemy import delete as sa_delete
    async with AsyncSessionFactory() as db:
        pl = (await db.execute(
            select(PlaylistModel).where(PlaylistModel.id == playlist_id)
        )).scalar_one_or_none()
        if not pl or pl.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your playlist")
    async with AsyncSessionFactory() as db:
        async with db.begin():
            await db.execute(
                sa_delete(PlaylistItem).where(
                    PlaylistItem.playlist_id == playlist_id,
                    PlaylistItem.beatmap_id == beatmap_id,
                )
            )
    return {"ok": True}


@app.post("/playlists/{playlist_id}/love", status_code=200)
async def love_playlist(
    playlist_id: int,
    current_user: User = Depends(require_user),
):
    """Love (favorite) a public playlist. Returns loved=True and current snapshot_hash."""
    from models import Playlist as PlaylistModel, PlaylistLove, PlaylistItem
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy import func as sqlfunc
    import hashlib

    async with AsyncSessionFactory() as db:
        pl = (await db.execute(
            select(PlaylistModel).where(PlaylistModel.id == playlist_id)
        )).scalar_one_or_none()
        if not pl or not pl.is_public:
            raise HTTPException(status_code=404, detail="Playlist not found")
        if pl.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot love your own playlist")

    # Compute current snapshot hash
    async with AsyncSessionFactory() as db:
        item_ids = list((await db.execute(
            select(PlaylistItem.beatmap_id).where(PlaylistItem.playlist_id == playlist_id)
        )).scalars().all())
    sorted_ids = sorted(item_ids)
    snapshot_hash = hashlib.md5(",".join(sorted_ids).encode()).hexdigest() if sorted_ids else ""

    async with AsyncSessionFactory() as db:
        async with db.begin():
            stmt = pg_insert(PlaylistLove).values(
                user_id=current_user.id,
                playlist_id=playlist_id,
                snapshot_hash=snapshot_hash,
            ).on_conflict_do_update(
                index_elements=["user_id", "playlist_id"],
                set_={"snapshot_hash": snapshot_hash},
            )
            await db.execute(stmt)
            count = (await db.execute(
                select(sqlfunc.count()).select_from(PlaylistLove)
                .where(PlaylistLove.playlist_id == playlist_id)
            )).scalar_one()
            # Use raw SQL UPDATE to avoid triggering updated_at onupdate
            from sqlalchemy import text
            await db.execute(
                text("UPDATE playlists SET love_count = :count WHERE id = :id"),
                {"count": count, "id": playlist_id},
            )
    return {"ok": True, "loved": True, "love_count": count, "snapshot_hash": snapshot_hash}


@app.delete("/playlists/{playlist_id}/love", status_code=200)
async def unlove_playlist(
    playlist_id: int,
    current_user: User = Depends(require_user),
):
    """Remove love from a playlist."""
    from models import PlaylistLove, Playlist as PlaylistModel
    from sqlalchemy import delete as sa_delete, func as sqlfunc

    async with AsyncSessionFactory() as db:
        async with db.begin():
            await db.execute(
                sa_delete(PlaylistLove).where(
                    PlaylistLove.user_id == current_user.id,
                    PlaylistLove.playlist_id == playlist_id,
                )
            )

    async with AsyncSessionFactory() as db:
        async with db.begin():
            count = (await db.execute(
                select(sqlfunc.count()).select_from(PlaylistLove)
                .where(PlaylistLove.playlist_id == playlist_id)
            )).scalar_one()
            from sqlalchemy import text
            await db.execute(
                text("UPDATE playlists SET love_count = :count WHERE id = :id"),
                {"count": count, "id": playlist_id},
            )
    return {"ok": True, "loved": False, "love_count": count}


@app.get("/playlists/loved")
async def get_loved_playlists(current_user: User = Depends(require_user)):
    """Get all playlists loved by the current user, with update detection."""
    from models import Playlist as PlaylistModel, PlaylistLove
    from sqlalchemy.orm import selectinload

    async with AsyncSessionFactory() as db:
        love_rows = list((await db.execute(
            select(PlaylistLove).where(PlaylistLove.user_id == current_user.id)
            .order_by(PlaylistLove.loved_at.desc())
        )).scalars().all())

    if not love_rows:
        return {"playlists": []}

    playlist_ids = [r.playlist_id for r in love_rows]
    love_map = {r.playlist_id: r.snapshot_hash for r in love_rows}

    async with AsyncSessionFactory() as db:
        rows = list((await db.execute(
            select(PlaylistModel)
            .where(PlaylistModel.id.in_(playlist_ids), PlaylistModel.is_public == 1)
            .options(selectinload(PlaylistModel.user), selectinload(PlaylistModel.items))
        )).scalars().all())

    result = []
    for pl in rows:
        # include_items=True so covers are populated
        data = await _build_playlist_response(pl, include_items=True, current_user_id=current_user.id)
        current_hash = data["snapshot_hash"]
        saved_hash = love_map.get(pl.id)
        data["is_updated"] = bool(saved_hash and current_hash != saved_hash)
        result.append(data)

    return {"playlists": result}


@app.post("/playlists/{playlist_id}/love/sync", status_code=200)
async def sync_love_snapshot(
    playlist_id: int,
    current_user: User = Depends(require_user),
):
    """Update the user's love snapshot to the current playlist version (acknowledge update)."""
    from models import PlaylistLove, PlaylistItem
    from sqlalchemy import func as sqlfunc
    import hashlib

    async with AsyncSessionFactory() as db:
        love_row = (await db.execute(
            select(PlaylistLove).where(
                PlaylistLove.user_id == current_user.id,
                PlaylistLove.playlist_id == playlist_id,
            )
        )).scalar_one_or_none()
        if not love_row:
            raise HTTPException(status_code=404, detail="You haven't loved this playlist")

    async with AsyncSessionFactory() as db:
        item_ids = list((await db.execute(
            select(PlaylistItem.beatmap_id).where(PlaylistItem.playlist_id == playlist_id)
        )).scalars().all())
    sorted_ids = sorted(item_ids)
    new_hash = hashlib.md5(",".join(sorted_ids).encode()).hexdigest() if sorted_ids else ""

    async with AsyncSessionFactory() as db:
        async with db.begin():
            await db.execute(
                PlaylistLove.__table__.update()
                .where(
                    PlaylistLove.user_id == current_user.id,
                    PlaylistLove.playlist_id == playlist_id,
                )
                .values(snapshot_hash=new_hash)
            )
    return {"ok": True, "snapshot_hash": new_hash}


@app.get("/playlists/my")
async def my_playlists(current_user: User = Depends(require_user)):
    """Get the current user's own playlists (public + private)."""
    from models import Playlist as PlaylistModel
    from sqlalchemy.orm import selectinload
    async with AsyncSessionFactory() as db:
        rows = list((await db.execute(
            select(PlaylistModel).where(PlaylistModel.user_id == current_user.id)
            .options(selectinload(PlaylistModel.user), selectinload(PlaylistModel.items))
            .order_by(PlaylistModel.updated_at.desc())
        )).scalars().all())
    return {"playlists": [await _build_playlist_response(pl) for pl in rows]}
