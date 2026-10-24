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
        f"?alternatives={str(alternatives).lower()}&overview=full&geometries=geojson&steps=true"
    )
    try:
        payload = get_json(url)
    except Exception as exc:
        raise ProviderUnavailable("The routing provider is unavailable. Try again in a moment.") from exc
    routes = []
    for item in payload.get("routes", []):
        geometry = item.get("geometry", {}).get("coordinates", [])
        if len(geometry) > 1:
            travelled_miles = travelled_minutes = 0.0
            travel_profile = []
            for leg in item.get("legs", []):
                for step in leg.get("steps", []):
                    travelled_miles += float(step.get("distance", 0)) / 1609.344
                    travelled_minutes += float(step.get("duration", 0)) / 60
                    if travelled_miles > 0:
                        travel_profile.append((travelled_miles, travelled_minutes))
            routes.append({"geometry": geometry, "distance_miles": item["distance"] / 1609.344, "duration_minutes": item["duration"] / 60, "travel_profile": travel_profile})
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


def _sample_geometry(geometry: list[list[float]], samples: int = 12) -> list[list[float]]:
    """Equally-spaced points used only to reject nearly identical alternatives."""
    distance = route_distance(geometry)
    return [interpolate_geometry(geometry, distance * index / (samples - 1)) for index in range(samples)]


def _same_corridor(a: dict, b: dict) -> bool:
    """Treat routes with the same road corridor as duplicates, not alternatives."""
    if abs(a["distance_miles"] - b["distance_miles"]) > 2:
        return False
    a_points, b_points = _sample_geometry(a["geometry"]), _sample_geometry(b["geometry"])
    mean_separation = sum(haversine(one, two) for one, two in zip(a_points, b_points)) / len(a_points)
    return mean_separation < 0.35


def fetch_routes(origin: dict, destination: dict) -> list[dict]:
    """Fetch exactly three distinct drivable routes from OSRM."""
    direct = f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}"
    candidates = _osrm_routes(direct, alternatives=3)
    routes: list[dict] = []
    for candidate in candidates:
        if not any(_same_corridor(candidate, route) for route in routes):
            routes.append(candidate)
    for coordinates in _detour_coordinates(origin, destination):
        if len(routes) >= 3:
            break
        for candidate in _osrm_routes(coordinates):
            if any(_same_corridor(candidate, route) for route in routes):
                continue
            routes.append(candidate)
            if len(routes) == 3:
                return routes
    if len(routes) == 3:
        return routes
    raise ProviderUnavailable("The routing provider could not find three distinct drivable routes for this trip.")


def _metric_risk(value: float, cuts: tuple[float, float, float, float], *, no_travel_at_limit: bool = True) -> str:
    for index, limit in enumerate(cuts):
        if value < limit or (index == 3 and not no_travel_at_limit and value == limit):
            return RISK_LEVELS[index]
    return "No Travel"


def classify_risk(wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_weight_lb: float, wind_gust_mph: float | None = None) -> tuple[str, str]:
    """Apply weather thresholds to sustained wind or a higher reported gust."""
    effective_wind = max(wind_mph, wind_gust_mph or 0)
    wind_source = "Wind gust" if wind_gust_mph and wind_gust_mph > wind_mph else "Wind"
    risks = [
        (_metric_risk(effective_wind, (25, 35, 45, 55)), f"{wind_source} {effective_wind:.0f} mph"),
        (_metric_risk(rain_in_hr, (0.10, 0.25, 0.50, 1.00), no_travel_at_limit=False), f"Rain {rain_in_hr:.2f} in/hr"),
        (_metric_risk(snow_in_hr, (0.5, 1.0, 2.0, 3.0), no_travel_at_limit=False), f"Snow {snow_in_hr:.1f} in/hr"),
    ]
    base_risk, cause = max(risks, key=lambda item: RISK_SCORE[item[0]])
    load_risk, load_cause = "Low", None
    if effective_wind >= 55:
        load_risk, load_cause = "No Travel", f"{wind_source} {effective_wind:.0f} mph >= 55 -> No Travel (any load)"
    elif 45 <= effective_wind < 55 and load_weight_lb > 30000:
        load_risk, load_cause = "No Travel", f"{wind_source} {effective_wind:.0f} mph + {load_weight_lb:,.0f} lb load -> No Travel"
    elif 35 <= effective_wind < 45 and load_weight_lb > 40000:
        load_risk, load_cause = "Severe", f"{wind_source} {effective_wind:.0f} mph + {load_weight_lb:,.0f} lb load -> Severe"
    risk = max((base_risk, load_risk), key=lambda level: RISK_SCORE[level])
    if load_cause and risk == load_risk:
        return risk, load_cause
    return risk, f"{cause} -> {risk}" if risk != "Low" else "Conditions clear"


def forecast_for_points(points: list[tuple[float, float, datetime]]) -> list[dict]:
    """Retrieve hourly forecast values for checkpoint ETAs in compact batches."""
    if not points:
        return []
    output: list[dict | None] = [None] * len(points)
    unique: dict[tuple[float, float], list[int]] = {}
    for index, (lat, lng, _) in enumerate(points):
        # ~11 metre precision avoids merging weather samples that are a kilometre apart.
        unique.setdefault((round(lat, 4), round(lng, 4)), []).append(index)
    locations = list(unique)

    def fetch_batch(batch: list[tuple[float, float]]) -> tuple[list[tuple[float, float]], list[dict]]:
        params = urlencode({
            "latitude": ",".join(str(lat) for lat, _ in batch), "longitude": ",".join(str(lng) for _, lng in batch),
            "hourly": "wind_speed_10m,wind_gusts_10m,rain,showers,snowfall", "wind_speed_unit": "mph", "precipitation_unit": "inch", "snowfall_unit": "inch", "timezone": "UTC", "forecast_days": 16,
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
                        output[index] = {
                            "wind_mph": float(hourly["wind_speed_10m"][hour_index] or 0),
                            "wind_gust_mph": float(hourly.get("wind_gusts_10m", hourly["wind_speed_10m"])[hour_index] or 0),
                            # Open-Meteo's precipitation includes snow water equivalent.
                            # Rain plus showers is rain-only, so snow is not double counted.
                            "rain_in_hr": float(hourly["rain"][hour_index] or 0) + float(hourly["showers"][hour_index] or 0),
                            "snow_in_hr": float(hourly["snowfall"][hour_index] or 0),
                        }
    except Exception as exc:
        raise ProviderUnavailable("The weather provider is unavailable. Try again in a moment.") from exc
    if any(weather is None for weather in output):
        raise ProviderUnavailable("The weather provider did not return a complete forecast for this trip.")
    return [weather for weather in output if weather is not None]


def rank_routes(routes: list[dict]) -> list[dict]:
    """Apply the required ranking using precision values, never rounded display miles."""
    viable = [route for route in routes if not route["no_travel"]]
    return sorted(
        viable,
        key=lambda route: (
            route["_raw_miles_by_risk"]["Severe"],
            route["_raw_miles_by_risk"]["High"],
            route["avg_risk_score"],
            route["duration_minutes"],
        ),
    )


def _eta_minutes_at_mile(raw_route: dict, mile: float) -> float:
    """Use OSRM's per-road-step durations rather than one constant trip speed."""
    total_miles, total_minutes = raw_route["distance_miles"], raw_route["duration_minutes"]
    if mile <= 0 or total_miles <= 0:
        return 0.0
    if mile >= total_miles:
        return total_minutes
    profile = raw_route.get("travel_profile") or []
    if not profile:
        return total_minutes * mile / total_miles
    profile_miles = profile[-1][0]
    if profile_miles <= 0:
        return total_minutes * mile / total_miles
    target = mile * profile_miles / total_miles
    previous_miles = previous_minutes = 0.0
    for end_miles, end_minutes in profile:
        if target <= end_miles:
            step_miles = end_miles - previous_miles
            ratio = (target - previous_miles) / step_miles if step_miles else 0
            return previous_minutes + ratio * (end_minutes - previous_minutes)
        previous_miles, previous_minutes = end_miles, end_minutes
    return total_minutes


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
        checks = [{"mile": 0.0, "point": geometry[0], "eta": departure, "name": "Origin"}]
        point_requests.append((geometry[0][1], geometry[0][0], departure))
        for mile in range(interval, max(interval, int(miles)), interval):
            if mile >= miles:
                break
            point = interpolate_geometry(geometry, mile)
            eta = departure + timedelta(minutes=_eta_minutes_at_mile(raw, mile))
            checks.append({"mile": mile, "point": point, "eta": eta, "name": f"Checkpoint at mile {mile}"})
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
            checkpoint_data.append({"mile": check["mile"], "lat": round(check["point"][1], 4), "lng": round(check["point"][0], 4), "name": check["name"], "eta": check["eta"].isoformat(), **{k: round(v, 2) for k, v in values.items()}, "risk": risk, "driving_factor": factor})
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
        no_travel_checkpoint = next((point for point in all_samples if point["risk"] == "No Travel"), None)
        routes.append({"id": work["id"], "summary": f"Road route option {index + 1}", "distance_miles": round(raw["distance_miles"]), "duration_minutes": round(raw["duration_minutes"]), "eta": (departure + timedelta(minutes=raw["duration_minutes"])).isoformat(), "overall_risk": overall, "no_travel": overall == "No Travel", "no_travel_reason": f"{no_travel_checkpoint['driving_factor']} at mile {no_travel_checkpoint['mile']}" if no_travel_checkpoint else None, "avg_risk_score": round(average, 2), "miles_by_risk": rounded_miles, "geometry": geometry, "segments": segments, "checkpoints": checkpoint_data, "_raw_miles_by_risk": miles_by_risk})
    ranked = rank_routes(routes)
    recommended = ranked[0] if ranked else None
    if recommended:
        reason = f"Lowest risk: {recommended['miles_by_risk']['Severe']} Severe mi, {recommended['miles_by_risk']['High']} High mi, average score {recommended['avg_risk_score']}."
    else:
        reason = "No route is safe to travel in this window. Consider delaying departure."
    for route in routes:
        route.pop("_raw_miles_by_risk", None)
    return {"trip_id": trip_id, "departure_time": departure.isoformat(), "recommended_route_id": recommended["id"] if recommended else None, "recommendation_reason": reason, "routes": routes}


def heatmap_points(routes: list[dict], hour: int, layer: str, departure: datetime) -> dict:
    """Return real Open-Meteo forecast samples across the trip corridor."""
    positions, seen = [], set()
    for route in routes:
        for longitude, latitude in route["geometry"][::max(1, len(route["geometry"]) // 64)]:
            key = (round(latitude, 4), round(longitude, 4))
            if key in seen:
                continue
            seen.add(key)
            positions.append((latitude, longitude))
    valid_time = departure + timedelta(hours=hour)
    forecast = forecast_for_points([(lat, lng, valid_time) for lat, lng in positions])
    points = []
    for (latitude, longitude), values in zip(positions, forecast):
        effective_wind = max(values["wind_mph"], values.get("wind_gust_mph", 0))
        wind_risk = _metric_risk(effective_wind, (25, 35, 45, 55))
        rain_risk = _metric_risk(values["rain_in_hr"], (.1, .25, .5, 1), no_travel_at_limit=False)
        snow_risk = _metric_risk(values["snow_in_hr"], (.5, 1, 2, 3), no_travel_at_limit=False)
        if layer == "wind":
            value, risk = effective_wind, wind_risk
        elif layer == "rain":
            value, risk = values["rain_in_hr"], rain_risk
        elif layer == "snow":
            value, risk = values["snow_in_hr"], snow_risk
        else:
            risk = max((wind_risk, rain_risk, snow_risk), key=lambda item: RISK_SCORE[item])
            value = RISK_SCORE[risk]
        points.append({"lat": latitude, "lng": longitude, "value": round(value, 2), "risk": risk})
    return {"hour": hour, "valid_time": valid_time.isoformat(), "points": points}
