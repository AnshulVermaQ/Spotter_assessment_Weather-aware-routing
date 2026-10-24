// Single API service layer. It can use a direct deployed API or Vite's local proxy.
import type {
  HeatmapLayer,
  HeatmapResponse,
  Place,
  TripRequest,
  TripResponse,
} from "@/types";
import { mockAnalyze, mockGeocode, mockHeatmap } from "@/mocks/data";
import { useTripStore } from "@/hooks/useTripStore";

const configuredBase = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(
  /\/$/,
  "",
);
const explicitlyMocked = import.meta.env["VITE_USE_MOCKS"] === "true";
const useLocalProxy = import.meta.env["VITE_USE_LOCAL_API_PROXY"] === "true";
// An empty BASE with `useLocalProxy` deliberately means same-origin `/api`.
// Vite forwards it to Django; this works in browser-preview environments where
// the browser cannot access the host's 127.0.0.1 directly.
const BASE = explicitlyMocked ? "" : (configuredBase ?? (useLocalProxy ? "" : null));
const USE_API = !explicitlyMocked;
export const USING_MOCKS = explicitlyMocked;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (BASE === null) {
    throw new Error(
      "The API URL is not configured. Set VITE_API_BASE_URL or set VITE_USE_LOCAL_API_PROXY=true, then restart the frontend.",
    );
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(
      "Cannot reach the Django API. Confirm the backend is running and restart the frontend server.",
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function geocode(q: string): Promise<Place[]> {
  if (!USE_API) {
    await delay(150);
    return mockGeocode(q);
  }
  return http<Place[]>(`/api/geocode?q=${encodeURIComponent(q)}`);
}

export async function analyzeRoutes(req: TripRequest): Promise<TripResponse> {
  if (!USE_API) {
    await delay(900);
    return mockAnalyze(req, useTripStore.getState().simulateNoTravel);
  }
  return http<TripResponse>("/api/routes/analyze", { method: "POST", body: JSON.stringify(req) });
}

export async function getHeatmap(
  tripId: string,
  routeIds: string[],
  hour: number,
  layer: HeatmapLayer,
): Promise<HeatmapResponse> {
  if (!USE_API) {
    await delay(120);
    const { result, request } = useTripStore.getState();
    const routes = (result?.routes ?? []).filter((r) => routeIds.includes(r.id));
    return mockHeatmap(routes, hour, layer, request?.departure_time ?? new Date().toISOString());
  }
  return http<HeatmapResponse>(
    `/api/heatmap?trip_id=${encodeURIComponent(tripId)}&route_ids=${routeIds.join(",")}&hour=${hour}&layer=${layer}`,
  );
}
