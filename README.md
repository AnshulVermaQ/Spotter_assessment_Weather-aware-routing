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
the destination. Checkpoint arrival times use OSRM's road-step duration profile
instead of spreading the total duration at a constant speed. Weather is sampled
at each checkpoint's calculated arrival time. Wind, rain, and snow risks are classified with the supplied thresholds;
rain and snow become **No Travel** only when they are greater than 1.00 in/hr
and 3.0 in/hr respectively. The higher of sustained wind and hourly wind gust
is used for wind risk. Load rules can only increase a weather risk. Forecast
coordinates are deduplicated at four decimal places (about 11 metres), not one
kilometre.

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

## Deploy both apps on Vercel

Deploy `backend/` and `frontend/` as two Vercel projects from this same GitHub
repository. The backend is a Django/Python project that Vercel discovers from
`manage.py`; the frontend is explicitly configured as TanStack Start.

1. In Vercel Marketplace, create a managed Postgres database (Neon or
   Supabase), then retain its `DATABASE_URL` connection string. Vercel's Neon
   integration may inject `POSTGRES_URL` instead; the backend accepts either.
2. Create the **backend** Vercel project with root directory `backend`. Add
   `DJANGO_DEBUG=false`, a long random `DJANGO_SECRET_KEY`, the managed
   `DATABASE_URL`, and `DJANGO_ALLOWED_HOSTS=your-api.vercel.app`. Set the
   build command to `python manage.py migrate --noinput`, then deploy.
3. Create the **frontend** Vercel project with root directory `frontend`. Add
   `VITE_API_BASE_URL=https://your-api.vercel.app`,
   `VITE_USE_LOCAL_API_PROXY=false`, `VITE_USE_MOCKS=false`, and
   `NITRO_PRESET=vercel`, then deploy.
4. Copy the final frontend URL into the backend setting
   `DJANGO_CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app`, and
   redeploy the backend. Test `https://your-api.vercel.app/api/health` before
   testing route analysis in the frontend.

Full click-by-click instructions are provided in the project handoff. Do not
commit either app's real secrets or its `DATABASE_URL`.

Run automated checks before submitting:

```powershell
cd backend
python manage.py test
cd ..\frontend
npm run build
```
