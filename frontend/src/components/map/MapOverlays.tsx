import { useEffect } from "react";
import {
  CloudRain,
  Eye,
  EyeOff,
  Layers,
  Milestone,
  Pause,
  Play,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTripStore } from "@/hooks/useTripStore";
import { useHeatmap } from "@/hooks/useHeatmap";
import { LOAD_RULES, ROUTE_HEX, ROUTE_LETTER } from "@/lib/risk";
import { RISK_LEVELS, type HeatmapLayer } from "@/types";
import { RISK_DOT } from "../RiskBadge";
import { cn } from "@/lib/utils";

const LAYERS: { id: HeatmapLayer; label: string }[] = [
  { id: "wind", label: "Wind" },
  { id: "rain", label: "Rain" },
  { id: "snow", label: "Snow" },
  { id: "combined", label: "Combined" },
];
const panel =
  "rounded-xl border bg-card/85 shadow-float backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-500";

const TOOLS = [
  { id: "weather", label: "WeatherSeek", icon: CloudRain },
  { id: "interstates", label: "Interstates", icon: Milestone },
] as const;

export function MapToolbar() {
  const poi = useTripStore((s) => s.poi);
  const toggle = useTripStore((s) => s.togglePoi);
  return (
    <div
      className={cn(panel, "flex max-w-full flex-wrap gap-1 rounded-2xl p-1.5")}
      role="toolbar"
      aria-label="Map layers"
    >
      {TOOLS.map(({ id, label, icon: Icon }, i) => (
        <button
          key={id}
          onClick={() => toggle(id)}
          aria-pressed={poi[id]}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-medium transition-all duration-200 active:scale-95 lg:px-3 lg:py-1.5 lg:text-sm",
            poi[id]
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-secondary/70 text-secondary-foreground hover:bg-accent",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

export function MapLegend() {
  return (
    <div className={cn(panel, "p-2.5 text-xs")} aria-label="Risk legend">
      <div className="mb-1.5 flex items-center justify-between gap-3 font-semibold">
        Risk
        <Popover>
          <PopoverTrigger className="text-[11px] font-normal text-primary underline-offset-2 hover:underline">
            Load rules
          </PopoverTrigger>
          <PopoverContent className="w-64 text-xs">
            <ul className="list-disc space-y-1 pl-4">
              {LOAD_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      <ul className="space-y-1">
        {RISK_LEVELS.map((r) => (
          <li key={r} className="flex items-center gap-2">
            <span className={cn("h-2 w-5 rounded-sm", RISK_DOT[r])} aria-hidden />
            {r}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Wind &lt;25 · 25 · 35 · 45 · ≥55 mph
      </p>
    </div>
  );
}

export function MapControls() {
  const result = useTripStore((s) => s.result);
  const hidden = useTripStore((s) => s.hiddenRoutes);
  const toggle = useTripStore((s) => s.toggleRoute);
  const on = useTripStore((s) => s.heatmapOn);
  const setOn = useTripStore((s) => s.setHeatmapOn);
  const layer = useTripStore((s) => s.heatmapLayer);
  const setLayer = useTripStore((s) => s.setHeatmapLayer);

  return (
    <div className={cn(panel, "w-52 space-y-2.5 p-2.5 text-xs")}>
      <label className="flex items-center justify-between gap-2 font-semibold">
        <span className="flex items-center gap-1.5">
          <Layers className="size-3.5" aria-hidden />
          Weather heatmap
        </span>
        <Switch
          checked={on}
          onCheckedChange={setOn}
          disabled={!result}
          aria-label="Toggle weather heatmap"
        />
      </label>
      {on && (
        <div role="radiogroup" aria-label="Heatmap layer" className="grid grid-cols-2 gap-1">
          {LAYERS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={layer === l.id}
              onClick={() => setLayer(l.id)}
              className={cn(
                "rounded border px-1.5 py-1",
                layer === l.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
      {result && (
        <div className="space-y-1 border-t pt-2">
          <div className="font-semibold">Routes</div>
          {result.routes.map((r) => (
            <button
              key={r.id}
              onClick={() => toggle(r.id)}
              aria-pressed={!hidden[r.id]}
              className="flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-accent"
            >
              <span
                className="h-1.5 w-4 rounded"
                style={{ background: ROUTE_HEX[r.id] }}
                aria-hidden
              />
              <span className="flex-1 text-left">Route {ROUTE_LETTER[r.id]}</span>
              {hidden[r.id] ? (
                <EyeOff className="size-3.5 text-muted-foreground" aria-label="hidden" />
              ) : (
                <Eye className="size-3.5" aria-label="visible" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TimeSlider() {
  const on = useTripStore((s) => s.heatmapOn);
  const hour = useTripStore((s) => s.hour);
  const setHour = useTripStore((s) => s.setHour);
  const playing = useTripStore((s) => s.playing);
  const setPlaying = useTripStore((s) => s.setPlaying);
  const departure = useTripStore((s) => s.request?.departure_time);
  const { isFetching } = useHeatmap();

  useEffect(() => {
    if (!playing || !on) return;
    const t = setInterval(() => {
      const h = useTripStore.getState().hour;
      setHour(h >= 48 ? 0 : h + 1);
    }, 700);
    return () => clearInterval(t);
  }, [playing, on, setHour]);

  if (!on || !departure) return null;
  const abs = new Date(new Date(departure).getTime() + hour * 3600000);
  return (
    <div className={cn(panel, "flex items-center gap-3 px-3 py-2")}>
      <button
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? "Pause forecast animation" : "Play forecast animation"}
        className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="flex-1">
        <Slider
          min={0}
          max={48}
          step={1}
          value={[hour]}
          onValueChange={([v]) => setHour(v ?? 0)}
          aria-label="Forecast hour"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>+0h</span>
          <span>+24h</span>
          <span>+48h</span>
        </div>
      </div>
      <div className="w-28 shrink-0 text-right" aria-live="polite">
        <div className="font-mono text-sm font-semibold">
          +{hour}h {isFetching && <span className="text-muted-foreground">·</span>}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {abs.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
