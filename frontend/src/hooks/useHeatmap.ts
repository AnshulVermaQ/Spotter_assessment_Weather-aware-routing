import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHeatmap } from "@/api/routingApi";
import { useTripStore } from "./useTripStore";
import type { HeatmapLayer } from "@/types";

const key = (tripId: string, ids: string[], hour: number, layer: HeatmapLayer) =>
  ["heatmap", tripId, ids.join(","), hour, layer] as const;

export function useHeatmap() {
  const result = useTripStore((s) => s.result);
  const on = useTripStore((s) => s.heatmapOn);
  const layer = useTripStore((s) => s.heatmapLayer);
  const hour = useTripStore((s) => s.hour);
  const ids = result?.routes.map((r) => r.id) ?? [];
  const tripId = result?.trip_id ?? "";
  const qc = useQueryClient();

  const [debouncedHour, setDebouncedHour] = useState(hour);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHour(hour), 150);
    return () => clearTimeout(t);
  }, [hour]);

  const enabled = on && ids.length > 0;
  const query = useQuery({
    queryKey: key(tripId, ids, debouncedHour, layer),
    queryFn: () => getHeatmap(tripId, ids, debouncedHour, layer),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // Prefetch adjacent hours for smooth scrubbing
  useEffect(() => {
    if (!enabled) return;
    for (const h of [debouncedHour - 1, debouncedHour + 1, debouncedHour + 2]) {
      if (h < 0 || h > 48) continue;
      qc.prefetchQuery({
        queryKey: key(tripId, ids, h, layer),
        queryFn: () => getHeatmap(tripId, ids, h, layer),
        staleTime: 5 * 60_000,
        retry: false,
      });
    }
  }, [enabled, tripId, debouncedHour, layer, ids.join(","), qc]);

  return { data: enabled ? query.data : undefined, isFetching: query.isFetching };
}
