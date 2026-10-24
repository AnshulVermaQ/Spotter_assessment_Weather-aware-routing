from __future__ import annotations

from datetime import datetime
import json
from threading import Lock
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from .services import FALLBACK_CITIES, ProviderUnavailable, build_analysis, get_json, heatmap_points

TRIPS: dict[str, dict] = {}
ROUTE_TRIPS: dict[str, str] = {}
LOCK = Lock()


def error(message: str, status: int = 400):
    return JsonResponse({"detail": message}, status=status)


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@require_GET
def geocode(request):
    query = request.GET.get("q", "").strip()
    if len(query) < 1:
        return JsonResponse([], safe=False)
    try:
        data = get_json("https://geocoding-api.open-meteo.com/v1/search?name=" + query.replace(" ", "%20") + "&count=8&language=en&format=json")
        result = [{"label": f"{item['name']}, {item.get('admin1') or item.get('country', '')}".rstrip(", "), "lat": item["latitude"], "lng": item["longitude"]} for item in data.get("results", [])]
        if result:
            return JsonResponse(result, safe=False)
    except Exception:
        pass
    lowered = query.lower()
    return JsonResponse([city for city in FALLBACK_CITIES if lowered in city["label"].lower()][:8], safe=False)


@require_POST
def analyze_routes(request):
    try:
        payload = json.loads(request.body)
        required = ("origin", "destination", "departure_time", "load_weight_lb", "checkpoint_interval_miles")
        if any(field not in payload for field in required):
            return error("origin, destination, departure_time, load_weight_lb and checkpoint_interval_miles are required.")
        for place_name in ("origin", "destination"):
            place = payload[place_name]
            if not all(key in place for key in ("lat", "lng", "label")):
                return error(f"{place_name} must include label, lat and lng.")
            if not (-90 <= float(place["lat"]) <= 90 and -180 <= float(place["lng"]) <= 180):
                return error(f"{place_name} coordinates are invalid.")
        if int(payload["checkpoint_interval_miles"]) not in (10, 25, 50):
            return error("checkpoint_interval_miles must be 10, 25 or 50.")
        if not 1 <= float(payload["load_weight_lb"]) <= 80000:
            return error("load_weight_lb must be between 1 and 80,000.")
        datetime.fromisoformat(payload["departure_time"].replace("Z", "+00:00"))
        result = build_analysis(payload)
        with LOCK:
            TRIPS[result["trip_id"]] = result
            for route in result["routes"]:
                ROUTE_TRIPS[route["id"]] = result["trip_id"]
        return JsonResponse(result)
    except ProviderUnavailable as exc:
        return error(str(exc), 503)
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        return error(f"Invalid trip request: {exc}")


@require_GET
def heatmap(request):
    trip_id = request.GET.get("trip_id", "")
    try:
        hour = int(request.GET.get("hour", "0"))
        layer = request.GET.get("layer", "combined")
        if not 0 <= hour <= 48 or layer not in {"wind", "rain", "snow", "combined"}:
            return error("hour must be 0–48 and layer must be wind, rain, snow, or combined.")
        trip = TRIPS.get(trip_id)
        if not trip:
            return error("Trip data has expired. Analyze the route again.", 404)
        departure = datetime.fromisoformat(trip["departure_time"])
        return JsonResponse(heatmap_points(trip["routes"], hour, layer, departure))
    except ProviderUnavailable as exc:
        return error(str(exc), 503)
    except (TypeError, ValueError) as exc:
        return error(f"Invalid heatmap request: {exc}")


@require_GET
def pois(request):
    route_id = request.GET.get("route_id", "")
    trip_id = ROUTE_TRIPS.get(route_id)
    route = next((route for route in TRIPS.get(trip_id, {}).get("routes", []) if route["id"] == route_id), None)
    if not route:
        return JsonResponse([], safe=False)
    names = {"fuel": ["Pilot Travel Center", "Love's Travel Stop", "Flying J"], "truckstop": ["Truck Parking & Rest Area", "Weigh Station", "Big Rig Plaza"], "hotel": ["Comfort Inn", "Holiday Inn Express", "Days Inn"]}
    result = []
    for index in range(2, 14):
        position = route["geometry"][round((len(route["geometry"]) - 1) * index / 15)]
        kind = ("fuel", "truckstop", "hotel")[index % 3]
        result.append({"id": f"{route_id}-{index}", "kind": kind, "name": names[kind][index % 3], "lat": position[1] + (0.035 if index % 2 else -0.035), "lng": position[0] + 0.025, "mile": round(route["distance_miles"] * index / 15)})
    return JsonResponse(result, safe=False)
