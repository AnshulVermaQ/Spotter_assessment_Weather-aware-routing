from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from .services import FALLBACK_CITIES, ProviderUnavailable, build_analysis, get_json, heatmap_points
from .models import TripAnalysis


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
        departure = datetime.fromisoformat(payload["departure_time"].replace("Z", "+00:00"))
        if departure.tzinfo is None:
            departure = departure.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if departure < now:
            return error("Departure time must be in the future.")
        if departure > now + timedelta(days=16):
            return error("Departure time must be within the 16-day forecast window.")
        result = build_analysis(payload)
        TripAnalysis.objects.update_or_create(trip_id=result["trip_id"], defaults={"payload": result})
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
        analysis = TripAnalysis.objects.filter(trip_id=trip_id).only("payload", "heatmaps").first()
        if not analysis:
            return error("Trip analysis was not found. Analyze the route again.", 404)
        trip = analysis.payload
        cache_key = f"{hour}:{layer}"
        if cached := analysis.heatmaps.get(cache_key):
            return JsonResponse(cached)
        departure = datetime.fromisoformat(trip["departure_time"])
        response = heatmap_points(trip["routes"], hour, layer, departure)
        analysis.heatmaps = {**analysis.heatmaps, cache_key: response}
        analysis.save(update_fields=["heatmaps", "updated_at"])
        return JsonResponse(response)
    except ProviderUnavailable as exc:
        return error(str(exc), 503)
    except (TypeError, ValueError) as exc:
        return error(f"Invalid heatmap request: {exc}")
