# Agri AI

Agri AI is a Telugu-first agriculture assistant prototype for farmers in Andhra Pradesh and nearby states.

This workspace turns the original single-file HTML demo into a real app shape:

- `backend/` - FastAPI API that owns AI provider calls and recommendation logic.
- `frontend/` - React mobile-first web app that can later be moved to React Native.
- `docs/prototype-review.md` - what was fake/demo-only in the original HTML and what is now real.

## Quick Start

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Set `ANTHROPIC_API_KEY` in `backend/.env` to enable real AI photo diagnosis. Without it, the backend returns a clearly marked safe fallback.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## Current Reality

The backend is real FastAPI. The AI diagnosis endpoint is wired for Anthropic vision models, but it needs your API key. Fertilizer advice currently uses a deterministic rules engine plus can be extended with your dad's knowledge and agronomy data.

Do not use this for final farming advice yet. Treat it as a field-testing MVP that must be validated by a local expert before farmers rely on it.

## Paddy Variety + Weather Logic

The app now includes a starter paddy registry in `backend/app/varieties.py`:

- AP/Telangana varieties such as `BPT 5204`, `MTU 1010`, `MTU 7029 / Swarna`, `MTU 1121`, `RNR 15048`, `KNM 118`, and `JGL 18047`.
- Tamil Nadu varieties such as `ADT 36`, `ADT 43`, `ADT(R) 45`, `ADT 51`, `ADT 52`, `CR 1009`, `CR 1009 Sub1`, and `Improved White Ponni`.
- Season options such as `Kharif`, `Rabi`, `Kuruvai`, `Samba`, `Late Samba`, `Thaladi`, `Navarai`, and `Sornavari`.
- District coordinates for starter live weather lookup.

Live weather uses Open-Meteo through `backend/app/weather.py`, which does not need an API key.

Starter data sources used while building:

- TNAU Agritech rice season and varieties page.
- ANGRAU public paddy variety/acreage references.
- PJTSAU/Telangana rice variety references found in public agriculture material.
- Open-Meteo forecast API documentation.

Before this reaches farmers, confirm the variety list and fertilizer numbers with your dad/local agriculture officer. The app should grow from field validation, not just web data.
