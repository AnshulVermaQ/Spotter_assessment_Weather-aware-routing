# WeatherWise Haul Routes

This repository keeps the two applications separate:

- `frontend/` — React, TanStack Start, MapLibre user interface.
- `backend/` — Django API for routes, forecast sampling, risk scoring, heatmap, and POIs.

## Run locally

The simplest local workflow uses one terminal from the `frontend` directory:

```powershell
cd frontend
npm install
npm run dev:fullstack
```

This keeps Django and Vite running together. Stop both with `Ctrl+C`.
Open the `Local:` URL printed by Vite (it prefers `http://localhost:8090` and
uses the next available port if one is already occupied). The launcher binds
Django to localhost on port 8010 and directs the
frontend to that API.

Alternatively, use two terminals from this directory.

```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py runserver 127.0.0.1:8010 --noreload
```

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

The local frontend uses `http://127.0.0.1:8010`; no Wi-Fi IP address or firewall rule is needed.

## Data integrity

- The Django service asks OSRM for three distinct drivable road corridors. It does not draw synthetic fallback lines.
- Open-Meteo is queried at each checkpoint's calculated ETA and again for every heatmap hour from 0 through 48.
- If either provider is unavailable, the API returns HTTP 503 instead of making up safety data.

Run automated checks before submitting:

```powershell
cd backend
python manage.py test
cd ..\frontend
npm run build
```
