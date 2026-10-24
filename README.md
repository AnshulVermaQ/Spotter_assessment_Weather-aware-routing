# WeatherWise Haul Routes

This repository keeps the two applications separate:

- `frontend/` — React, TanStack Start, MapLibre user interface.
- `backend/` — Django API for routes, forecast sampling, risk scoring, recommendations, and heatmaps.

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
python manage.py migrate
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
- Analyses and heatmap-hour responses are stored in Django's database, so a normal
  worker restart does not make an active trip disappear.
- The map does not render fabricated fuel, hotel, or truck-stop records.

## Risk and recommendation rules

Each route includes the origin, every selected 10/25/50-mile checkpoint, and
the destination. Weather is sampled at each checkpoint's calculated arrival
time. Wind, rain, and snow risks are classified with the supplied thresholds;
rain and snow become **No Travel** only when they are greater than 1.00 in/hr
and 3.0 in/hr respectively. Load rules can only increase a weather risk.

Viable routes are ranked, in order, by unrounded Severe miles, unrounded High
miles, average risk score, then travel time. Routes containing a No Travel
segment are not recommended.

The planner accepts only locations in the contiguous United States. Alaska,
Hawaii, U.S. territories, and international destinations are intentionally
excluded.

## Production configuration

Set these values in the Django host environment before deploying:

```text
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<a-long-random-secret>
DJANGO_ALLOWED_HOSTS=api.example.com
DJANGO_CORS_ALLOWED_ORIGINS=https://app.example.com
```

Set `VITE_API_BASE_URL=https://api.example.com` in the frontend build
environment. The UI now reports a configuration error if neither that URL nor
the explicit local proxy is configured; it never silently switches to mock
route data. For multi-instance hosting, point Django at a shared production
database (rather than an ephemeral local SQLite volume).

Run automated checks before submitting:

```powershell
cd backend
python manage.py test
cd ..\frontend
npm run build
```
