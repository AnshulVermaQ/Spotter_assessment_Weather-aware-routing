import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HeatmapLayer, TripRequest, TripResponse } from "@/types";

interface TripState {
  request: TripRequest | null;
  result: TripResponse | null;
  selectedRouteId: string | null;
  hiddenRoutes: Record<string, boolean>;
  focusedCheckpoint: { routeId: string; mile: number; nonce: number } | null;
  heatmapOn: boolean;
  heatmapLayer: HeatmapLayer;
  hour: number;
  playing: boolean;
  simulateNoTravel: boolean;
  /** True once the stored trip has been read back (or the read was refused). */
  hasHydrated: boolean;
  poi: Record<"weather" | "interstates", boolean>;
  mobileView: "plan" | "map";
  togglePoi: (k: keyof TripState["poi"]) => void;
  setMobileView: (v: "plan" | "map") => void;
  setResult: (req: TripRequest, res: TripResponse) => void;
  selectRoute: (id: string) => void;
  toggleRoute: (id: string) => void;
  focusCheckpoint: (routeId: string, mile: number) => void;
  setHeatmapOn: (v: boolean) => void;
  setHeatmapLayer: (l: HeatmapLayer) => void;
  setHour: (h: number) => void;
  setPlaying: (p: boolean) => void;
  setSimulateNoTravel: (v: boolean) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      request: null,
      result: null,
      selectedRouteId: null,
      hiddenRoutes: {},
      focusedCheckpoint: null,
      heatmapOn: false,
      heatmapLayer: "wind",
      hour: 0,
      playing: false,
      simulateNoTravel: false,
      hasHydrated: false,
      poi: { weather: true, interstates: false },
      mobileView: "plan",
      togglePoi: (k) => set((s) => ({ poi: { ...s.poi, [k]: !s.poi[k] } })),
      setMobileView: (mobileView) => set({ mobileView }),
      setResult: (request, result) =>
        set(() => {
          const recommendedId = result.recommended_route_id ?? result.routes[0]?.id ?? null;
          return {
            request,
            result,
            selectedRouteId: recommendedId,
            // Start with the safest route only. The driver can explicitly reveal
            // either alternative with its eye control when comparison is useful.
            hiddenRoutes: Object.fromEntries(
              result.routes
                .filter((route) => route.id !== recommendedId)
                .map((route) => [route.id, true]),
            ),
            focusedCheckpoint: null,
            hour: 0,
          };
        }),
      selectRoute: (id) =>
        set((s) => ({ selectedRouteId: id, hiddenRoutes: { ...s.hiddenRoutes, [id]: false } })),
      toggleRoute: (id) =>
        set((s) => ({ hiddenRoutes: { ...s.hiddenRoutes, [id]: !s.hiddenRoutes[id] } })),
      focusCheckpoint: (routeId, mile) =>
        set({ focusedCheckpoint: { routeId, mile, nonce: Date.now() } }),
      setHeatmapOn: (heatmapOn) => set({ heatmapOn }),
      setHeatmapLayer: (heatmapLayer) => set({ heatmapLayer }),
      setHour: (hour) => set({ hour }),
      setPlaying: (playing) => set({ playing }),
      setSimulateNoTravel: (simulateNoTravel) => set({ simulateNoTravel }),
    }),
    {
      name: "safehaul-trip",
      // Preserve the current trip through a refresh so map state is restored.
      // Hydration is manual (see __root) so server render and first client render match.
      skipHydration: true,
      partialize: (s) => ({
        request: s.request,
        result: s.result,
        selectedRouteId: s.selectedRouteId,
      }),
    },
  ),
);
