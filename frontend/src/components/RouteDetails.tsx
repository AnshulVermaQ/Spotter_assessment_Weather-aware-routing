import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskBadge } from "./RiskBadge";
import { useTripStore } from "@/hooks/useTripStore";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime, ROUTE_LETTER } from "@/lib/risk";
import { RISK_LEVELS, type Route } from "@/types";
import { useState } from "react";

export function RouteDetails({ route }: { route: Route }) {
  const focus = useTripStore((s) => s.focusCheckpoint);
  const focused = useTripStore((s) => s.focusedCheckpoint);
  const [byRisk, setByRisk] = useState(true);
  const rank = (r: Route["checkpoints"][number]) => RISK_LEVELS.indexOf(r.risk);
  const points = byRisk
    ? [...route.checkpoints].sort((a, b) => rank(a) - rank(b) || a.mile - b.mile)
    : route.checkpoints;
  const flagged = route.checkpoints
    .filter((c) => c.risk !== "Low" && c.risk !== "Moderate")
    .sort((a, b) => rank(a) - rank(b) || a.mile - b.mile);

  return (
    <section
      aria-label={`Route ${ROUTE_LETTER[route.id]} details`}
      className="rounded-xl border bg-card shadow-sm"
    >
      <Tabs defaultValue="summary">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className="font-semibold">Route {ROUTE_LETTER[route.id]} details</h3>
          <TabsList className="h-8">
            <TabsTrigger value="summary" className="text-xs">
              Summary
            </TabsTrigger>
            <TabsTrigger value="checkpoints" className="text-xs">
              Checkpoints ({route.checkpoints.length})
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="summary" className="m-0 space-y-3 p-3 text-sm">
          <dl className="grid grid-cols-2 gap-2">
            {[
              ["Distance", `${route.distance_miles} mi`],
              ["Drive time", formatDuration(route.duration_minutes)],
              ["Arrive", formatTime(route.eta)],
              ["Avg score", `${route.avg_risk_score.toFixed(2)} / 5`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-muted px-2 py-1.5">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="font-mono font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Hazard checkpoints
            </h4>
            {flagged.length === 0 ? (
              <p className="text-muted-foreground">No High or worse conditions along this route.</p>
            ) : (
              <ul className="space-y-1">
                {flagged.slice(0, 6).map((c) => (
                  <li key={c.mile} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      Mile {c.mile} · {c.driving_factor}
                    </span>
                    <RiskBadge risk={c.risk} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="checkpoints" className="m-0">
          <div className="flex items-center justify-end gap-1 border-b px-3 py-1.5 text-xs">
            <span className="mr-1 text-muted-foreground">Sort:</span>
            {[
              ["Risk", true],
              ["Mile", false],
            ].map(([l, v]) => (
              <button
                key={String(l)}
                onClick={() => setByRisk(v as boolean)}
                aria-pressed={byRisk === v}
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-medium",
                  byRisk === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-1.5 font-medium">Mile</th>
                  <th className="px-2 py-1.5 font-medium">Location / ETA</th>
                  <th
                    className="px-2 py-1.5 text-right font-medium"
                    title="Wind mph / Rain in/hr / Snow in/hr"
                  >
                    W · R · S
                  </th>
                  <th className="px-2 py-1.5 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {points.map((c) => {
                  const hot = c.risk === "High" || c.risk === "Severe" || c.risk === "No Travel";
                  const isFocus = focused?.routeId === route.id && focused.mile === c.mile;
                  return (
                    <tr
                      key={c.mile}
                      tabIndex={0}
                      onClick={() => focus(route.id, c.mile)}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        (e.preventDefault(), focus(route.id, c.mile))
                      }
                      aria-label={`Mile ${c.mile}, ${c.name}, ${c.risk}. ${c.driving_factor}`}
                      className={cn(
                        "cursor-pointer border-b align-top outline-none hover:bg-accent focus-visible:bg-accent",
                        c.risk === "High" && "bg-risk-high/10",
                        c.risk === "Severe" && "bg-risk-severe/15",
                        c.risk === "No Travel" && "bg-risk-notravel/50",
                        isFocus && "ring-1 ring-inset ring-primary",
                      )}
                    >
                      <td className="px-2 py-1.5 font-mono font-semibold">{c.mile}</td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-muted-foreground">{formatTime(c.eta)}</div>
                        {hot && <div className="mt-0.5 text-foreground/90">{c.driving_factor}</div>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono">
                        {c.wind_mph}{c.wind_gust_mph && c.wind_gust_mph > c.wind_mph ? ` / gust ${c.wind_gust_mph}` : ""} · {c.rain_in_hr.toFixed(2)} · {c.snow_in_hr.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5">
                        <RiskBadge risk={c.risk} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
