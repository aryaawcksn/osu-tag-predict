# osu! Playstyle Predictor

## Backend 

1. Set environment
   ```
   MODEL_PATH=model_lstm_osu_dataset_vXIII.keras
   MLB_PATH=pickle_mlb_VXIII.pkl
   ```

## Frontend

1. Copy `.env.example` ke `.env`:
   ```
   VITE_API_URL=https://your-backend.app
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
