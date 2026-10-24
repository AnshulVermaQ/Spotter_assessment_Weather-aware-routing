export type RiskLevel = "Low" | "Moderate" | "High" | "Severe" | "No Travel";

export const RISK_LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Severe", "No Travel"];

export type LngLat = [number, number];

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface Checkpoint {
  mile: number;
  lat: number;
  lng: number;
  name: string;
  eta: string;
  wind_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  risk: RiskLevel;
  driving_factor: string;
}

export interface RouteSegment {
  coordinates: LngLat[];
  risk: RiskLevel;
}

export interface Route {
  id: string;
  summary: string;
  distance_miles: number;
  duration_minutes: number;
  eta: string;
  overall_risk: RiskLevel;
  no_travel: boolean;
  no_travel_reason: string | null;
  avg_risk_score: number;
  miles_by_risk: Record<RiskLevel, number>;
  geometry: LngLat[];
  segments: RouteSegment[];
  checkpoints: Checkpoint[];
}

export interface TripRequest {
  origin: Place;
  destination: Place;
  departure_time: string;
  load_weight_lb: number;
  checkpoint_interval_miles: 10 | 25 | 50;
}

export interface TripResponse {
  /** Opaque backend analysis key used for forecast/heatmap requests. */
  trip_id: string;
  recommended_route_id: string | null;
  recommendation_reason: string;
  routes: Route[];
}

export type HeatmapLayer = "wind" | "rain" | "snow" | "combined";

export interface HeatmapPoint {
  lat: number;
  lng: number;
  value: number;
  risk: RiskLevel;
}

export interface HeatmapResponse {
  hour: number;
  valid_time: string;
  points: HeatmapPoint[];
}

export type PoiKind = "fuel" | "truckstop" | "hotel";

export interface Poi {
  id: string;
  kind: PoiKind;
  name: string;
  lat: number;
  lng: number;
  mile: number;
}
