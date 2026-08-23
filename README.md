# OSU! Beatmap Analyzer Using AI Model

## Features
1. Analyze osu! beatmaps via URL or file upload
2. Analyze player's dominant playstyle from top plays / recent scores
3. Display recommendations based on the player's dominant playstyle
4. Display beatmaps along with detailed map information
5. Search beatmaps based on analyzed tags
6. Automatically save beatmaps after prediction or analysis
7. User login required to access recommendations and tag search

## Future Development
1. Add difficulty filtering based on player skill level

# Architecture

## Backend 

1. Built with FastAPI
   ```
   LSTM Vanilla Model
   MODEL_PATH=model_lstm_osu_dataset_vXIII.keras
   MLB_PATH=pickle_mlb_VXIII.pkl
   ```

## Frontend

1. Built with React + TypeScript + Vite
   ```
   VITE_API_URL=https://your-backend.app
   ```

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
