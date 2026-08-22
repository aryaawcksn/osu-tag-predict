import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import predictor

MODEL_PATH = os.environ.get("MODEL_PATH", "model_lstm_osu_dataset_vXIII.keras")
MLB_PATH   = os.environ.get("MLB_PATH",   "pickle_mlb_VXIII.pkl")


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.load_artifacts(MODEL_PATH, MLB_PATH)
    print(f"Model loaded: {MODEL_PATH}")
    yield


app = FastAPI(title="osu! Playstyle Predictor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tangani HTTP OPTIONS (Preflight) secara eksplisit untuk semua rute /predict
@app.options("/{full_path:path}")
def options_handler(full_path: str):
    return Response(status_code=200)


class LinkRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict/link")
def predict_link(req: LinkRequest):
    try:
        return predictor.predict_from_link(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.post("/predict/upload")
async def predict_upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".osu"):
        raise HTTPException(status_code=400, detail="Hanya file .osu yang diterima.")

    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".osu", delete=False, mode="wb") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = predictor.predict_from_file(tmp_path)
        result["filename"] = file.filename
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
    finally:
        os.unlink(tmp_path)