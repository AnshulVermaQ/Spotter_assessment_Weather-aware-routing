import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CloudRain,
  CloudSnow,
  Gauge,
  MapPin,
  Route as RouteIcon,
  Wind,
} from "lucide-react";
import { RiskBadge } from "@/components/RiskBadge";
import { useTripStore } from "@/hooks/useTripStore";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime, ROUTE_HEX, ROUTE_LETTER } from "@/lib/risk";
import { RISK_LEVELS, type Route } from "@/types";

export const Route = createFileRoute("/route-overview")({
  head: () => ({
    meta: [
      { title: "Route Weather Overview — Spotter Labs" },
      {
        name: "description",
        content: "Compare weather conditions and risk checkpoints for every truck route.",
      },
    ],
  }),
  component: RouteOverviewPage,
});

function PeakWeather({ route }: { route: Route }) {
  const checkpoints = route.checkpoints;
  const peakWind = Math.max(0, ...checkpoints.map((point) => point.wind_mph));
  const peakRain = Math.max(0, ...checkpoints.map((point) => point.rain_in_hr));
  const peakSnow = Math.max(0, ...checkpoints.map((point) => point.snow_in_hr));
  return (
    <dl className="grid grid-cols-3 divide-x rounded-lg border bg-muted/35 text-center">
      <div className="px-2 py-2">
        <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <Wind className="size-3" />
          Peak wind
        </dt>
        <dd className="mt-0.5 font-mono text-sm font-semibold">{peakWind.toFixed(0)} mph</dd>
      </div>
      <div className="px-2 py-2">
        <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <CloudRain className="size-3" />
          Peak rain
        </dt>
        <dd className="mt-0.5 font-mono text-sm font-semibold">{peakRain.toFixed(2)} in/h</dd>
      </div>
      <div className="px-2 py-2">
        <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <CloudSnow className="size-3" />
          Peak snow
        </dt>
        <dd className="mt-0.5 font-mono text-sm font-semibold">{peakSnow.toFixed(1)} in/h</dd>
      </div>
    </dl>
  );
}

function RouteWeatherSection({ route, recommended }: { route: Route; recommended: boolean }) {
  const rank = (risk: Route["checkpoints"][number]["risk"]) => RISK_LEVELS.indexOf(risk);
  const checkpoints = [...route.checkpoints].sort((a, b) => a.mile - b.mile);
  const flagged = checkpoints.filter((point) => rank(point.risk) >= rank("High"));
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm",
        recommended && "border-primary/70 ring-1 ring-primary/20",
      )}
    >
      <header className="flex flex-wrap items-center gap-3 border-b p-4">
        <span
          className="grid size-9 place-items-center rounded-lg font-mono font-bold text-primary-foreground"
          style={{ background: ROUTE_HEX[route.id] }}
        >
          {ROUTE_LETTER[route.id]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">
              Route {ROUTE_LETTER[route.id]} · {route.summary}
            </h2>
            {recommended && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {route.distance_miles} mi · {formatDuration(route.duration_minutes)} · arrives{" "}
            {formatTime(route.eta)}
          </p>
        </div>
        <RiskBadge risk={route.overall_risk} />
      </header>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/45 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg. risk</p>
            <p className="mt-0.5 font-mono text-lg font-bold">
              {route.avg_risk_score.toFixed(2)}{" "}
              <span className="text-xs text-muted-foreground">/ 5</span>
            </p>
          </div>
          <div className="rounded-lg bg-muted/45 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">High+ stops</p>
            <p className="mt-0.5 font-mono text-lg font-bold">{flagged.length}</p>
          </div>
          <div className="rounded-lg bg-muted/45 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Severe miles
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold">{route.miles_by_risk.Severe}</p>
          </div>
          <div className="rounded-lg bg-muted/45 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">High miles</p>
            <p className="mt-0.5 font-mono text-lg font-bold">{route.miles_by_risk.High}</p>
          </div>
        </div>
        <PeakWeather route={route} />
        {route.no_travel && (
          <p
            role="alert"
            className="rounded-lg border border-risk-severe/50 bg-risk-notravel/40 p-3 text-sm"
          >
            <strong>No Travel.</strong> {route.no_travel_reason}
          </p>
        )}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Weather at ETA checkpoints</h3>
            <span className="text-xs text-muted-foreground">
              Wind mph · Rain in/hr · Snow in/hr
            </span>
          </div>
          <div className="max-h-[360px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 font-medium">Mile</th>
                  <th className="px-3 py-2 font-medium">ETA</th>
                  <th className="px-3 py-2 font-medium">Wind</th>
                  <th className="px-3 py-2 font-medium">Rain</th>
                  <th className="px-3 py-2 font-medium">Snow</th>
                  <th className="px-3 py-2 font-medium">Risk / driving factor</th>
                </tr>
              </thead>
              <tbody>
                {checkpoints.map((point) => (
                  <tr
                    key={point.mile}
                    className={cn(
                      "border-b last:border-0",
                      point.risk === "High" && "bg-risk-high/10",
                      point.risk === "Severe" && "bg-risk-severe/15",
                      point.risk === "No Travel" && "bg-risk-notravel/45",
                    )}
                  >
                    <td className="px-3 py-2 font-mono font-semibold">{point.mile}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatTime(point.eta)}</td>
                    <td className="px-3 py-2 font-mono">{point.wind_mph}</td>
                    <td className="px-3 py-2 font-mono">{point.rain_in_hr.toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono">{point.snow_in_hr.toFixed(1)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <RiskBadge risk={point.risk} />
                        <span className="max-w-md text-xs text-muted-foreground">
                          {point.driving_factor}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function RouteOverviewPage() {
  const result = useTripStore((state) => state.result);
  const request = useTripStore((state) => state.request);
  if (!result || !request) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-h))] max-w-xl flex-col items-center justify-center px-5 text-center">
        <RouteIcon className="size-10 text-primary" />
        <h1 className="mt-4 text-xl font-bold">No route analysis yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Run a route search first, then open the full weather overview.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="size-4" />
          Go to planner
        </Link>
      </main>
    );
  }
  const routes = [...result.routes].sort(
    (a, b) =>
      Number(b.id === result.recommended_route_id) - Number(a.id === result.recommended_route_id),
  );
  return (
    <main className="min-h-[calc(100dvh-var(--nav-h))] bg-background">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to planner
        </Link>
        <header className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Trip weather overview
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Every route, every forecast checkpoint
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {request.origin.label} to {request.destination.label}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Load</p>
              <p className="font-mono font-semibold">
                {request.load_weight_lb.toLocaleString()} lb
              </p>
            </div>
          </div>
        </header>
        {routes.map((route) => (
          <RouteWeatherSection
            key={route.id}
            route={route}
            recommended={route.id === result.recommended_route_id}
          />
        ))}
      </div>
    </main>
  );
}
