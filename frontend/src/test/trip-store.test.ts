import { beforeEach, describe, expect, it } from "vitest";
import { useTripStore } from "@/hooks/useTripStore";
import type { TripRequest, TripResponse } from "@/types";

const request: TripRequest = {
  origin: { label: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  destination: { label: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  departure_time: "2026-10-25T12:00:00.000Z",
  load_weight_lb: 42000,
  checkpoint_interval_miles: 25,
};

const result = {
  trip_id: "test-trip",
  recommended_route_id: "route_b",
  recommendation_reason: "Lowest risk.",
  routes: ["route_a", "route_b", "route_c"].map((id) => ({
    id,
    summary: id,
    distance_miles: 100,
    duration_minutes: 120,
    eta: request.departure_time,
    overall_risk: "Low" as const,
    no_travel: false,
    no_travel_reason: null,
    avg_risk_score: 1,
    miles_by_risk: { Low: 100, Moderate: 0, High: 0, Severe: 0, "No Travel": 0 },
    geometry: [],
    segments: [],
    checkpoints: [],
  })),
} satisfies TripResponse;

describe("trip store route visibility", () => {
  beforeEach(() => {
    useTripStore.setState({ result: null, request: null, selectedRouteId: null, hiddenRoutes: {} });
  });

  it("shows only the recommended route after a new analysis", () => {
    useTripStore.getState().setResult(request, result);

    expect(useTripStore.getState().selectedRouteId).toBe("route_b");
    expect(useTripStore.getState().hiddenRoutes).toEqual({ route_a: true, route_c: true });
  });

  it("reveals a route when it is selected and toggles it independently", () => {
    useTripStore.getState().setResult(request, result);
    useTripStore.getState().selectRoute("route_a");
    expect(useTripStore.getState().hiddenRoutes.route_a).toBe(false);

    useTripStore.getState().toggleRoute("route_a");
    expect(useTripStore.getState().hiddenRoutes.route_a).toBe(true);
    expect(useTripStore.getState().hiddenRoutes.route_c).toBe(true);
  });
});
