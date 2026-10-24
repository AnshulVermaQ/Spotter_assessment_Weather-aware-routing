from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from django.test import SimpleTestCase
from .services import classify_risk


class RiskRulesTests(SimpleTestCase):
    def test_wind_no_travel_for_every_load(self):
        self.assertEqual(classify_risk(55, 0, 0, 1)[0], "No Travel")

    def test_heavy_load_turns_45_mph_wind_into_no_travel(self):
        self.assertEqual(classify_risk(45, 0, 0, 30001)[0], "No Travel")

    def test_very_heavy_load_turns_high_wind_severe(self):
        self.assertEqual(classify_risk(36, 0, 0, 40001)[0], "Severe")

    def test_rain_thresholds_apply(self):
        self.assertEqual(classify_risk(10, .25, 0, 10000)[0], "High")

    def test_analyze_endpoint_returns_three_provider_routes_and_forecast_heatmap(self):
        def provider(url: str):
            if "router.project-osrm.org" in url:
                return {"routes": [
                    {"distance": 100_000, "duration": 6_000, "geometry": {"coordinates": [[-87.63, 41.88], [-94, 40], [-104.99, 39.74]]}},
                    {"distance": 112_000, "duration": 6_900, "geometry": {"coordinates": [[-87.63, 41.88], [-96, 43], [-104.99, 39.74]]}},
                    {"distance": 125_000, "duration": 7_500, "geometry": {"coordinates": [[-87.63, 41.88], [-96, 37], [-104.99, 39.74]]}},
                ]}
            count = len(parse_qs(urlparse(url).query)["latitude"][0].split(","))
            hourly = {"time": ["2026-10-24T12:00"], "wind_speed_10m": [20], "precipitation": [0.05], "snowfall": [0]}
            return [{"hourly": hourly} for _ in range(count)]

        payload = {
            "origin": {"label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298},
            "destination": {"label": "Denver, CO", "lat": 39.7392, "lng": -104.9903},
            "departure_time": "2026-10-24T12:00:00Z",
            "load_weight_lb": 42000,
            "checkpoint_interval_miles": 50,
        }
        with patch("planner.services.get_json", side_effect=provider):
            response = self.client.post("/api/routes/analyze", data=payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["routes"]), 3)
        self.assertTrue(body["trip_id"])
        self.assertTrue(all(route["checkpoints"] and route["segments"] for route in body["routes"]))
        with patch("planner.services.get_json", side_effect=provider):
            heatmap = self.client.get(f"/api/heatmap?trip_id={body['trip_id']}&hour=12&layer=wind")
        self.assertEqual(heatmap.status_code, 200)
        self.assertEqual(heatmap.json()["hour"], 12)
        self.assertTrue(heatmap.json()["points"])

    @patch("planner.services.get_json", side_effect=OSError("provider offline"))
    def test_provider_outage_is_an_explicit_503_not_synthetic_data(self, _get_json):
        payload = {
            "origin": {"label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298},
            "destination": {"label": "Denver, CO", "lat": 39.7392, "lng": -104.9903},
            "departure_time": "2026-10-24T12:00:00Z", "load_weight_lb": 42000, "checkpoint_interval_miles": 50,
        }
        response = self.client.post("/api/routes/analyze", data=payload, content_type="application/json")
        self.assertEqual(response.status_code, 503)
