import { memo } from "react";
import { Ban, CheckCircle2, Eye, EyeOff, Star } from "lucide-react";
import { RiskBadge, RISK_DOT } from "./RiskBadge";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime, ROUTE_HEX, ROUTE_LETTER } from "@/lib/risk";
import { RISK_LEVELS, type Route } from "@/types";

interface Props {
  route: Route;
  recommended: boolean;
  reason: string;
  selected: boolean;
  onSelect: () => void;
  visible?: boolean;
  onToggleVisible?: () => void;
}

export const RouteCard = memo(function RouteCard({
  route,
  recommended,
  reason,
  selected,
  onSelect,
  visible = true,
  onToggleVisible,
}: Props) {
  const total = route.distance_miles || 1;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      aria-label={`Route ${ROUTE_LETTER[route.id]} ${route.summary}, ${route.overall_risk} risk${recommended ? ", recommended" : ""}`}
      className={cn(
        "relative w-full rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        recommended && "bg-recommended",
        route.no_travel && "border-risk-severe/60",
        selected
          ? "border-primary bg-accent shadow-float ring-2 ring-primary/30 -translate-y-0.5"
          : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="grid size-7 place-items-center rounded-lg font-mono text-sm font-bold text-primary-foreground shadow-sm"
            style={{ background: ROUTE_HEX[route.id] }}
            aria-hidden
          >
            {ROUTE_LETTER[route.id]}
          </span>
          <div>
            <div className="font-semibold leading-tight">{route.summary}</div>
            <div className="font-mono text-xs text-muted-foreground">
              {route.distance_miles} mi · {formatDuration(route.duration_minutes)} · ETA{" "}
              {formatTime(route.eta)}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <div className="flex flex-col items-end gap-1.5">
            <RiskBadge risk={route.overall_risk} />
            {selected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                <CheckCircle2 className="size-3" aria-hidden />
                Selected
              </span>
            )}
          </div>
          {onToggleVisible && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleVisible();
              }}
              aria-pressed={visible}
              aria-label={`${visible ? "Hide" : "Show"} Route ${ROUTE_LETTER[route.id]} on map`}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          )}
        </div>
      </div>
      {selected && (
        <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" aria-hidden />
      )}

      {recommended && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs text-success">
          <Star className="mt-0.5 size-3.5 shrink-0 fill-current" aria-hidden />
          <span>
            <strong>Recommended.</strong> {reason}
          </span>
        </div>
      )}
      {route.no_travel && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-1.5 rounded-md border border-risk-severe/50 bg-risk-notravel/60 px-2 py-1.5 text-xs"
        >
          <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <strong>No Travel — not eligible.</strong> {route.no_travel_reason}
          </span>
        </div>
      )}

      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={RISK_LEVELS.map((r) => `${route.miles_by_risk[r]} ${r} miles`).join(", ")}
      >
        {RISK_LEVELS.map(
          (r) =>
            route.miles_by_risk[r] > 0 && (
              <div
                key={r}
                className={RISK_DOT[r]}
                style={{ width: `${(route.miles_by_risk[r] / total) * 100}%` }}
              />
            ),
        )}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center">
        {RISK_LEVELS.map((r) => (
          <div
            key={r}
            className={cn(
              "text-[10px] leading-tight text-muted-foreground",
              route.miles_by_risk[r] > 0 &&
                (r === "Severe" || r === "No Travel") &&
                "text-risk-severe",
            )}
          >
            <div className="font-mono text-xs font-semibold text-foreground">
              {route.miles_by_risk[r]}
            </div>
            {r === "No Travel" ? "No Trv" : r}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Avg risk score{" "}
        <span className="font-mono font-semibold text-foreground">
          {route.avg_risk_score.toFixed(2)}
        </span>{" "}
        / 5
      </div>
    </div>
  );
});
