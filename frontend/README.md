# WeatherWise Haul Routes

Weather-aware route comparison for commercial drivers. The React map client calls a Django API that requests three OSRM driving alternatives, samples hourly Open-Meteo forecasts at each ETA checkpoint, applies the supplied weather and load rules, and ranks viable routes by Severe miles, High miles, average risk, then duration.

## Run locally

The easiest option runs both processes from one frontend terminal:

```powershell
npm run dev:fullstack
```

It starts Django on port 8010 at localhost, then Vite preferring port 8090; open the `Local:` URL Vite prints and stop both with `Ctrl+C`. Alternatively, open two terminals from the project root (the folder containing both `frontend` and `backend`).

```powershell
# API terminal
cd backend
python -m pip install -r requirements.txt
python manage.py runserver 127.0.0.1:8010 --noreload
```

```powershell
# React client terminal
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Set `VITE_USE_MOCKS=true` only to work on the interface without starting Django.

## API

- `GET /api/geocode?q=Chicago` — Open-Meteo city search, with common US-city fallback.
- `POST /api/routes/analyze` — route geometry, checkpoint weather/risk, summaries, and recommendation.
- `GET /api/heatmap?trip_id=...&hour=0..48&layer=wind|rain|snow|combined` — trip-corridor heatmap points.
- `GET /api/pois?route_id=route_a` — map support stops for the selected route.

The provider adapters use public, keyless OSRM and Open-Meteo endpoints. Every displayed route is a road geometry returned by OSRM; every checkpoint and heatmap value is an Open-Meteo hourly forecast at its displayed time. If either provider is unavailable, the API returns `503 Service Unavailable` rather than inventing a route or weather condition.

## Risk policy

Wind, rain, and snow are classified using the assessment thresholds. The highest condition wins, then the load overrides are applied: wind >=55 mph is No Travel; 45–54 mph with more than 30,000 lb is No Travel; and 35–44 mph with more than 40,000 lb is Severe. The API tests cover these boundaries.

## Verification

```powershell
cd backend
python manage.py test

cd ..\frontend
npm run build
```

For deployment, host Django behind HTTPS, set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, and an explicit `DJANGO_ALLOWED_HOSTS` list. Set `VITE_API_BASE_URL` to the HTTPS Django origin before building the frontend.
