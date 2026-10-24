import { useIsMutating } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CloudSun, Gauge } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteCard } from "./RouteCard";
import { RouteDetails } from "./RouteDetails";
import { useTripStore } from "@/hooks/useTripStore";
import { RISK_LEVELS } from "@/types";

export function ResultsPanel() {
  const result = useTripStore((s) => s.result);
  const selectedId = useTripStore((s) => s.selectedRouteId);
  const select = useTripStore((s) => s.selectRoute);
  const hiddenRoutes = useTripStore((s) => s.hiddenRoutes);
  const toggleRoute = useTripStore((s) => s.toggleRoute);
  const loading = useIsMutating({ mutationKey: ["analyze"] }) > 0;

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading routes">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!result) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        <CloudSun className="size-8 text-primary" aria-hidden />
        <p>Enter your trip and we'll compare three routes against the forecast along the way.</p>
      </div>
    );
  }
  if (!result.routes.length) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        No routes found between these places.
      </p>
    );
  }

  const sorted = [...result.routes].sort(
    (a, b) =>
      RISK_LEVELS.indexOf(a.overall_risk) - RISK_LEVELS.indexOf(b.overall_risk) ||
      a.avg_risk_score - b.avg_risk_score,
  );
  const recommended = result.routes.find((r) => r.id === result.recommended_route_id) ?? sorted[0];
  const selected = result.routes.find((r) => r.id === selectedId) ?? recommended;
  return (
    <div className="space-y-3">
      {!result.recommended_route_id && (
        <p
          role="alert"
          className="rounded-lg border border-risk-severe bg-risk-notravel/50 p-3 text-sm"
        >
          <strong>No safe route.</strong> {result.recommendation_reason}
        </p>
      )}
      <div className="space-y-2" role="list" aria-label="Route options">
        {sorted.map((route) => {
          const isRecommended = route.id === recommended?.id;
          const visible = isRecommended || !hiddenRoutes[route.id];
          return (
            <div key={route.id} role="listitem">
              <RouteCard
                route={route}
                recommended={isRecommended}
                reason={isRecommended ? result.recommendation_reason : ""}
                selected={route.id === selectedId}
                visible={visible}
                onSelect={() => select(route.id)}
                onToggleVisible={isRecommended ? undefined : () => toggleRoute(route.id)}
              />
            </div>
          );
        })}
      </div>
      <Link
        to="/route-overview"
        className="flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-primary/5"
      >
        <Gauge className="size-4 text-primary" />
        View full route weather overview
      </Link>
      {selected && (
        <div
          key={selected.id}
          className="animate-in fade-in slide-in-from-bottom-4 space-y-3 fill-mode-both duration-500"
          style={{ animationDelay: "300ms" }}
        >
          <RouteDetails route={selected} />
        </div>
      )}
    </div>
  );
}
