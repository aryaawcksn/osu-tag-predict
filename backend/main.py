import asyncio
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import predictor
from queue_manager import queue_manager

MODEL_PATH = os.environ.get("MODEL_PATH", "model_lstm_osu_dataset_vXIII.keras")
MLB_PATH   = os.environ.get("MLB_PATH",   "pickle_mlb_VXIII.pkl")


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.load_artifacts(MODEL_PATH, MLB_PATH)
    print(f"Model loaded: {MODEL_PATH}")
    try:
        await queue_manager.restore_from_db()
        print("Queue state restored from DB")
    except Exception as exc:
        print(f"Warning: could not restore queue from DB: {exc}")
    yield


app = FastAPI(title="osu! Playstyle Predictor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
