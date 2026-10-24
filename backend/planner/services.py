"""External-provider adapters and routing/risk calculations."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

RISK_LEVELS = ["Low", "Moderate", "High", "Severe", "No Travel"]
RISK_SCORE = {name: index + 1 for index, name in enumerate(RISK_LEVELS)}
FALLBACK_CITIES = [
    {"label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298},
    {"label": "Denver, CO", "lat": 39.7392, "lng": -104.9903},
    {"label": "Omaha, NE", "lat": 41.2565, "lng": -95.9345},
    {"label": "Kansas City, MO", "lat": 39.0997, "lng": -94.5786},
    {"label": "Des Moines, IA", "lat": 41.5868, "lng": -93.6250},
    {"label": "St. Louis, MO", "lat": 38.6270, "lng": -90.1994},
    {"label": "Dallas, TX", "lat": 32.7767, "lng": -96.7970},
    {"label": "Minneapolis, MN", "lat": 44.9778, "lng": -93.2650},
]


class ProviderUnavailable(RuntimeError):
    """A required third-party routing or forecast provider could not respond."""


def get_json(url: str, timeout: int = 10) -> Any:
    request = Request(url, headers={"User-Agent": "WeatherWiseHaulRoutes/1.0"})
    with urlopen(request, timeout=timeout) as response:  # nosec B310 - fixed provider URLs
        return json.loads(response.read().decode("utf-8"))


def haversine(a: list[float], b: list[float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    return 3958.7613 * 2 * math.asin(math.sqrt(math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2))


def route_distance(geometry: list[list[float]]) -> float:
    return sum(haversine(geometry[i - 1], geometry[i]) for i in range(1, len(geometry)))


def interpolate_geometry(geometry: list[list[float]], mile: float) -> list[float]:
    travelled = 0.0
    for index in range(1, len(geometry)):
        length = haversine(geometry[index - 1], geometry[index])
        if travelled + length >= mile:
            ratio = (mile - travelled) / length if length else 0
            a, b = geometry[index - 1], geometry[index]
            return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]
        travelled += length
    return geometry[-1]


def _osrm_routes(coordinates: str, alternatives: int | bool = False) -> list[dict]:
    """Ask OSRM for genuine road geometry; never invent a route corridor."""
    url = (
        f"https://router.project-osrm.org/route/v1/driving/{coordinates}"
        f"?alternatives={str(alternatives).lower()}&overview=full&geometries=geojson&steps=false"
    )
    try:
        payload = get_json(url)
    except Exception as exc:
        raise ProviderUnavailable("The routing provider is unavailable. Try again in a moment.") from exc
    routes = []
    for item in payload.get("routes", []):
        geometry = item.get("geometry", {}).get("coordinates", [])
        if len(geometry) > 1:
            routes.append({"geometry": geometry, "distance_miles": item["distance"] / 1609.344, "duration_minutes": item["duration"] / 60})
    return routes


def _detour_coordinates(origin: dict, destination: dict) -> list[str]:
    """Ask the provider for northern/southern real-road alternatives."""
    ox, oy, dx, dy = origin["lng"], origin["lat"], destination["lng"], destination["lat"]
    span = math.hypot(dx - ox, dy - oy)
    if span < 0.02:
        return []
    perpendicular = (-(dy - oy) / span, (dx - ox) / span)
    midx, midy = (ox + dx) / 2, (oy + dy) / 2
    offset = min(1.25, max(0.08, span * 0.11))
    variations = [(1, 1), (-1, 1), (1, 1.7), (-1, 1.7), (1, 0.55), (-1, 0.55)]
    return [
        f"{ox},{oy};{midx + perpendicular[0] * offset * scale * sign},{midy + perpendicular[1] * offset * scale * sign};{dx},{dy}"
        for sign, scale in variations
    ]


def fetch_routes(origin: dict, destination: dict) -> list[dict]:
    """Fetch exactly three distinct drivable routes from OSRM."""
    direct = f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}"
    candidates = _osrm_routes(direct, alternatives=3)
    for coordinates in _detour_coordinates(origin, destination):
        if len(candidates) >= 3:
            break
        candidates.extend(_osrm_routes(coordinates))
    routes: list[dict] = []
    for candidate in candidates:
        if any(abs(candidate["distance_miles"] - route["distance_miles"]) < 1 for route in routes):
            continue
        routes.append(candidate)
        if len(routes) == 3:
            return routes
    raise ProviderUnavailable("The routing provider could not find three distinct drivable routes for this trip.")


def _metric_risk(value: float, cuts: tuple[float, float, float, float]) -> str:
    for index, limit in enumerate(cuts):
        if value < limit:
            return RISK_LEVELS[index]
    return "No Travel"


def classify_risk(wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_weight_lb: float) -> tuple[str, str]:
    """Apply the assessment thresholds, then load-specific wind overrides."""
    risks = [
        (_metric_risk(wind_mph, (25, 35, 45, 55)), f"Wind {wind_mph:.0f} mph"),
        (_metric_risk(rain_in_hr, (0.10, 0.25, 0.50, 1.00)), f"Rain {rain_in_hr:.2f} in/hr"),
        (_metric_risk(snow_in_hr, (0.5, 1.0, 2.0, 3.0)), f"Snow {snow_in_hr:.1f} in/hr"),
    ]
    risk, cause = max(risks, key=lambda item: RISK_SCORE[item[0]])
    if wind_mph >= 55:
        return "No Travel", f"Wind {wind_mph:.0f} mph >= 55 -> No Travel (any load)"
    if 45 <= wind_mph < 55 and load_weight_lb > 30000:
        return "No Travel", f"Wind {wind_mph:.0f} mph + {load_weight_lb:,.0f} lb load -> No Travel"
    if 35 <= wind_mph < 45 and load_weight_lb > 40000:
        return "Severe", f"Wind {wind_mph:.0f} mph + {load_weight_lb:,.0f} lb load -> Severe"
    return risk, f"{cause} -> {risk}" if risk != "Low" else "Conditions clear"


def forecast_for_points(points: list[tuple[float, float, datetime]]) -> list[dict]:
    """Retrieve hourly forecast values for checkpoint ETAs in compact batches."""
    if not points:
        return []
    output: list[dict | None] = [None] * len(points)
    unique: dict[tuple[float, float], list[int]] = {}
    for index, (lat, lng, _) in enumerate(points):
        unique.setdefault((round(lat, 2), round(lng, 2)), []).append(index)
    locations = list(unique)

    def fetch_batch(batch: list[tuple[float, float]]) -> tuple[list[tuple[float, float]], list[dict]]:
        params = urlencode({
            "latitude": ",".join(str(lat) for lat, _ in batch), "longitude": ",".join(str(lng) for _, lng in batch),
            "hourly": "wind_speed_10m,precipitation,snowfall", "wind_speed_unit": "mph", "precipitation_unit": "inch", "snowfall_unit": "inch", "timezone": "UTC", "forecast_days": 16,
        })
        response = get_json(f"https://api.open-meteo.com/v1/forecast?{params}")
        forecasts = response if isinstance(response, list) else [response]
        return batch, forecasts

    batches = [locations[start : start + 80] for start in range(0, len(locations), 80)]
    try:
        # A typical 10-mile plan has hundreds of checkpoints. Open-Meteo accepts
        # coordinate arrays, and bounded parallel batches keep the UI responsive.
        with ThreadPoolExecutor(max_workers=min(4, len(batches))) as pool:
            futures = [pool.submit(fetch_batch, batch) for batch in batches]
            for future in as_completed(futures):
                batch, forecasts = future.result()
                for key, weather in zip(batch, forecasts):
                    hourly = weather.get("hourly", {})
                    times = hourly.get("time", [])
                    if not times:
                        continue
                    for index in unique[key]:
                        target = points[index][2].replace(tzinfo=None).strftime("%Y-%m-%dT%H:00")
                        hour_index = min(range(len(times)), key=lambda i: abs((datetime.fromisoformat(times[i]) - datetime.fromisoformat(target)).total_seconds()))
                        output[index] = {"wind_mph": float(hourly["wind_speed_10m"][hour_index] or 0), "rain_in_hr": float(hourly["precipitation"][hour_index] or 0), "snow_in_hr": float(hourly["snowfall"][hour_index] or 0)}
    except Exception as exc:
        raise ProviderUnavailable("The weather provider is unavailable. Try again in a moment.") from exc
    if any(weather is None for weather in output):
        raise ProviderUnavailable("The weather provider did not return a complete forecast for this trip.")
    return [weather for weather in output if weather is not None]


def build_analysis(request_data: dict) -> dict:
    origin, destination = request_data["origin"], request_data["destination"]
    departure = datetime.fromisoformat(request_data["departure_time"].replace("Z", "+00:00"))
    if departure.tzinfo is None:
        departure = departure.replace(tzinfo=timezone.utc)
    weight = float(request_data["load_weight_lb"])
    interval = int(request_data["checkpoint_interval_miles"])
    trip_id = uuid4().hex[:12]
    raw_routes = fetch_routes(origin, destination)
    route_work: list[dict] = []
    point_requests: list[tuple[float, float, datetime]] = []
    for index, raw in enumerate(raw_routes):
        geometry, miles, minutes = raw["geometry"], raw["distance_miles"], raw["duration_minutes"]
        checks = []
        for mile in range(interval, max(interval, int(miles)), interval):
            if mile >= miles:
                break
            point = interpolate_geometry(geometry, mile)
            eta = departure + timedelta(minutes=minutes * mile / miles)
            checks.append({"mile": mile, "point": point, "eta": eta})
            point_requests.append((point[1], point[0], eta))
        terminal_eta = departure + timedelta(minutes=minutes)
        terminal = {"mile": miles, "point": geometry[-1], "eta": terminal_eta}
        point_requests.append((geometry[-1][1], geometry[-1][0], terminal_eta))
        route_work.append({"id": f"route_{chr(97 + index)}", "raw": raw, "checks": checks, "terminal": terminal})
    weather = iter(forecast_for_points(point_requests))
    routes = []
    for index, work in enumerate(route_work):
        raw, geometry, checks, terminal = work["raw"], work["raw"]["geometry"], work["checks"], work["terminal"]
        checkpoint_data = []
        for check in checks:
            values = next(weather)
            risk, factor = classify_risk(**values, load_weight_lb=weight)
            checkpoint_data.append({"mile": check["mile"], "lat": round(check["point"][1], 4), "lng": round(check["point"][0], 4), "name": f"Checkpoint at mile {check['mile']}", "eta": check["eta"].isoformat(), **{k: round(v, 2) for k, v in values.items()}, "risk": risk, "driving_factor": factor})
        # Sample the destination ETA too, so every displayed risk segment comes
        # from the same live forecast source as the regular checkpoints.
        terminal_values = next(weather)
        terminal_risk, terminal_factor = classify_risk(**terminal_values, load_weight_lb=weight)
        all_samples = checkpoint_data + [{"mile": terminal["mile"], "lat": geometry[-1][1], "lng": geometry[-1][0], "eta": terminal["eta"], "risk": terminal_risk, "driving_factor": terminal_factor, **terminal_values}]
        miles_by_risk = {risk: 0.0 for risk in RISK_LEVELS}
        segments, previous_mile, previous_point = [], 0.0, geometry[0]
        for sample in all_samples:
            end = [sample["lng"], sample["lat"]]
            length = max(0, sample["mile"] - previous_mile)
            miles_by_risk[sample["risk"]] += length
            segments.append({"coordinates": [previous_point, end], "risk": sample["risk"]})
            previous_mile, previous_point = sample["mile"], end
        rounded_miles = {risk: round(value) for risk, value in miles_by_risk.items()}
        average = sum(RISK_SCORE[risk] * value for risk, value in miles_by_risk.items()) / raw["distance_miles"]
        overall = max((risk for risk, value in miles_by_risk.items() if value > 0), key=lambda risk: RISK_SCORE[risk], default="Low")
        no_travel_checkpoint = next((point for point in checkpoint_data if point["risk"] == "No Travel"), None)
        summaries = ["Primary route", "Northern weather avoidance", "Southern weather avoidance"]
        routes.append({"id": work["id"], "summary": summaries[index], "distance_miles": round(raw["distance_miles"]), "duration_minutes": round(raw["duration_minutes"]), "eta": (departure + timedelta(minutes=raw["duration_minutes"])).isoformat(), "overall_risk": overall, "no_travel": overall == "No Travel", "no_travel_reason": f"{no_travel_checkpoint['driving_factor']} at mile {no_travel_checkpoint['mile']}" if no_travel_checkpoint else None, "avg_risk_score": round(average, 2), "miles_by_risk": rounded_miles, "geometry": geometry, "segments": segments, "checkpoints": checkpoint_data})
    viable = [route for route in routes if not route["no_travel"]]
    ranked = sorted(viable, key=lambda r: (r["miles_by_risk"]["Severe"], r["miles_by_risk"]["High"], r["avg_risk_score"], r["duration_minutes"]))
    recommended = ranked[0] if ranked else None
    if recommended:
        reason = f"Lowest risk: {recommended['miles_by_risk']['Severe']} Severe mi, {recommended['miles_by_risk']['High']} High mi, average score {recommended['avg_risk_score']}."
    else:
        reason = "No route is safe to travel in this window. Consider delaying departure."
    return {"trip_id": trip_id, "departure_time": departure.isoformat(), "recommended_route_id": recommended["id"] if recommended else None, "recommendation_reason": reason, "routes": routes}


def heatmap_points(routes: list[dict], hour: int, layer: str, departure: datetime) -> dict:
    """Return real Open-Meteo forecast samples across the trip corridor."""
    positions, seen = [], set()
    for route in routes:
        for longitude, latitude in route["geometry"][::max(1, len(route["geometry"]) // 32)]:
            key = (round(latitude, 2), round(longitude, 2))
            if key in seen:
                continue
            seen.add(key)
            positions.append((latitude, longitude))
    valid_time = departure + timedelta(hours=hour)
    forecast = forecast_for_points([(lat, lng, valid_time) for lat, lng in positions])
    points = []
    for (latitude, longitude), values in zip(positions, forecast):
        wind_risk = _metric_risk(values["wind_mph"], (25, 35, 45, 55))
        rain_risk = _metric_risk(values["rain_in_hr"], (.1, .25, .5, 1))
        snow_risk = _metric_risk(values["snow_in_hr"], (.5, 1, 2, 3))
        if layer == "wind":
            value, risk = values["wind_mph"], wind_risk
        elif layer == "rain":
            value, risk = values["rain_in_hr"], rain_risk
        elif layer == "snow":
            value, risk = values["snow_in_hr"], snow_risk
        else:
            risk = max((wind_risk, rain_risk, snow_risk), key=lambda item: RISK_SCORE[item])
            value = RISK_SCORE[risk]
        points.append({"lat": latitude, "lng": longitude, "value": round(value, 2), "risk": risk})
    return {"hour": hour, "valid_time": valid_time.isoformat(), "points": points}
