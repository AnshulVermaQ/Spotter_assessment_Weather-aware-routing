from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from django.test import TestCase
from .models import TripAnalysis
from .services import classify_risk, fetch_routes, rank_routes


class RiskRulesTests(TestCase):
    def test_wind_no_travel_for_every_load(self):
        self.assertEqual(classify_risk(55, 0, 0, 1)[0], "No Travel")

    def test_heavy_load_turns_45_mph_wind_into_no_travel(self):
        self.assertEqual(classify_risk(45, 0, 0, 30001)[0], "No Travel")

    def test_very_heavy_load_turns_high_wind_severe(self):
        self.assertEqual(classify_risk(36, 0, 0, 40001)[0], "Severe")

    def test_rain_thresholds_apply(self):
        self.assertEqual(classify_risk(10, .25, 0, 10000)[0], "High")

    def test_load_rule_never_lowers_rain_or_snow_no_travel(self):
        self.assertEqual(classify_risk(40, 1.5, 0, 45000)[0], "No Travel")
        self.assertEqual(classify_risk(40, 0, 3.1, 45000)[0], "No Travel")

    def test_rain_and_snow_no_travel_boundaries_are_exclusive(self):
        self.assertEqual(classify_risk(10, 1.00, 0, 10000)[0], "Severe")
        self.assertEqual(classify_risk(10, 0, 3.0, 10000)[0], "Severe")
        self.assertEqual(classify_risk(10, 1.001, 0, 10000)[0], "No Travel")
        self.assertEqual(classify_risk(10, 0, 3.01, 10000)[0], "No Travel")

    def test_ranking_uses_raw_miles_not_rounded_display_miles(self):
        routes = [
            {"id": "route_a", "no_travel": False, "_raw_miles_by_risk": {"Severe": 0.49, "High": 0}, "avg_risk_score": 1, "duration_minutes": 1},
            {"id": "route_b", "no_travel": False, "_raw_miles_by_risk": {"Severe": 0.40, "High": 99}, "avg_risk_score": 5, "duration_minutes": 999},
        ]
        self.assertEqual(rank_routes(routes)[0]["id"], "route_b")

    @patch("planner.services._osrm_routes")
    def test_duplicate_provider_alternatives_do_not_block_distinct_detours(self, provider_routes):
        def route(points):
            return {"geometry": points, "distance_miles": 100, "duration_minutes": 120}

        direct = route([[0, 0], [1, 0], [2, 0]])
        north = route([[0, 0], [1, 1], [2, 0]])
        south = route([[0, 0], [1, -1], [2, 0]])
        provider_routes.side_effect = [[direct, direct, direct], [north], [south]]

        routes = fetch_routes(
            {"lng": 0, "lat": 0},
            {"lng": 2, "lat": 0},
        )

        self.assertEqual(len(routes), 3)
        self.assertEqual(provider_routes.call_count, 3)

    def test_analyze_endpoint_returns_three_provider_routes_and_forecast_heatmap(self):
        def provider(url: str):
            if "router.project-osrm.org" in url:
                return {"routes": [
                    {"distance": 100_000, "duration": 6_000, "geometry": {"coordinates": [[-87.63, 41.88], [-94, 40], [-104.99, 39.74]]}},
                    {"distance": 112_000, "duration": 6_900, "geometry": {"coordinates": [[-87.63, 41.88], [-96, 43], [-104.99, 39.74]]}},
                    {"distance": 125_000, "duration": 7_500, "geometry": {"coordinates": [[-87.63, 41.88], [-96, 37], [-104.99, 39.74]]}},
                ]}
            count = len(parse_qs(urlparse(url).query)["latitude"][0].split(","))
            hourly = {"time": ["2026-10-24T12:00"], "wind_speed_10m": [20], "rain": [0.05], "showers": [0.02], "snowfall": [0]}
            return [{"hourly": hourly} for _ in range(count)]

        payload = {
            "origin": {"label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298},
            "destination": {"label": "Denver, CO", "lat": 39.7392, "lng": -104.9903},
            "departure_time": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
            "load_weight_lb": 42000,
            "checkpoint_interval_miles": 50,
        }
        with patch("planner.services.get_json", side_effect=provider):
            response = self.client.post("/api/routes/analyze", data=payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["routes"]), 3)
        self.assertTrue(body["trip_id"])
        self.assertTrue(TripAnalysis.objects.filter(trip_id=body["trip_id"]).exists())
        self.assertTrue(all(route["checkpoints"] and route["segments"] for route in body["routes"]))
        self.assertTrue(all(route["checkpoints"][0]["mile"] == 0 for route in body["routes"]))
        with patch("planner.services.get_json", side_effect=provider):
            heatmap = self.client.get(f"/api/heatmap?trip_id={body['trip_id']}&hour=12&layer=wind")
        self.assertEqual(heatmap.status_code, 200)
        self.assertEqual(heatmap.json()["hour"], 12)
        self.assertTrue(heatmap.json()["points"])

    def test_past_or_out_of_window_departures_are_rejected(self):
        base = {
            "origin": {"label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298},
            "destination": {"label": "Denver, CO", "lat": 39.7392, "lng": -104.9903},
            "load_weight_lb": 42000, "checkpoint_interval_miles": 50,
        }
        for departure in (datetime.now(timezone.utc) - timedelta(minutes=1), datetime.now(timezone.utc) + timedelta(days=16, minutes=1)):
            response = self.client.post("/api/routes/analyze", data={**base, "departure_time": departure.isoformat()}, content_type="application/json")
            self.assertEqual(response.status_code, 400)

    @patch("planner.services.get_json", side_effect=OSError("provider offline"))
    def test_provider_outage_is_an_explicit_503_not_synthetic_data(self, _get_json):
        payload = {
            "origin": {"label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298},
            "destination": {"label": "Denver, CO", "lat": 39.7392, "lng": -104.9903},
            "departure_time": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(), "load_weight_lb": 42000, "checkpoint_interval_miles": 50,
        }
        response = self.client.post("/api/routes/analyze", data=payload, content_type="application/json")
        self.assertEqual(response.status_code, 503)
