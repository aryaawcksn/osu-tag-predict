# osu! Playstyle Predictor

## Backend (Railway)

1. Copy model & pickle ke folder `backend/`:
   - `model_lstm_osu_dataset_vXIII.keras`
   - `pickle_mlb_VXIII.pkl`

2. Set environment variables di Railway:
   ```
   MODEL_PATH=model_lstm_osu_dataset_vXIII.keras
   MLB_PATH=pickle_mlb_VXIII.pkl
   ```

3. Railway akan auto-detect `Dockerfile` dan build otomatis.

## Frontend (Vercel)

1. Copy `.env.example` ke `.env`:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```

2. Di Vercel, set environment variable `VITE_API_URL` ke URL Railway backend.

3. Root directory: `frontend/`, build command: `npm run build`, output: `dist/`.

## Local Dev

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```
