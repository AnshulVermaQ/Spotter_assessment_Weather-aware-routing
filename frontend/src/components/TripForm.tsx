import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import { analyzeRoutes } from "@/api/routingApi";
import { useTripStore } from "@/hooks/useTripStore";
import { MOCK_PLACES } from "@/mocks/data";
import { cn } from "@/lib/utils";
import type { Place, TripRequest } from "@/types";

const toLocalInput = (d: Date) => {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
const WEIGHTS = [10000, 30000, 45000, 80000];
const INTERVALS = [10, 25, 50] as const;

export function useAnalyze() {
  const setResult = useTripStore((s) => s.setResult);
  return useMutation({
    mutationKey: ["analyze"],
    mutationFn: (req: TripRequest) => analyzeRoutes(req).then((res) => ({ req, res })),
    onSuccess: ({ req, res }) => setResult(req, res),
  });
}

export function TripForm() {
  const [origin, setOrigin] = useState<Place | null>(MOCK_PLACES[0] ?? null);
  const [dest, setDest] = useState<Place | null>(MOCK_PLACES[1] ?? null);
  const [departure, setDeparture] = useState(() => toLocalInput(new Date(Date.now() + 3600000)));
  const [weight, setWeight] = useState("42000");
  const [interval, setInterval] = useState<10 | 25 | 50>(25);
  const [errors, setErrors] = useState<
    Partial<Record<"origin" | "dest" | "departure" | "weight", string>>
  >({});
  const analyze = useAnalyze();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<"origin" | "dest" | "departure" | "weight", string>> = {};
    const w = Number(weight);
    if (!origin) errs.origin = "Pick an origin from the list.";
    if (!dest) errs.dest = "Pick a destination from the list.";
    if (origin && dest && origin.label === dest.label)
      errs.dest = "Destination must differ from origin.";
    if (!departure || isNaN(new Date(departure).getTime()))
      errs.departure = "Enter a valid departure time.";
    if (!Number.isFinite(w) || w < 1 || w > 80000)
      errs.weight = "Load must be between 1 and 80,000 lb.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    analyze.mutate({
      origin: origin!,
      destination: dest!,
      departure_time: new Date(departure).toISOString(),
      load_weight_lb: Math.round(w),
      checkpoint_interval_miles: interval,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-label="Trip details">
      <div className="grid gap-3">
        <PlaceAutocomplete
          label="Origin"
          value={origin}
          onChange={setOrigin}
          error={errors.origin}
        />
        <PlaceAutocomplete
          label="Destination"
          value={dest}
          onChange={setDest}
          error={errors.dest}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="departure"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Departure
        </label>
        <Input
          id="departure"
          type="datetime-local"
          value={departure}
          onChange={(e) => setDeparture(e.target.value)}
          aria-invalid={!!errors.departure}
          className="[color-scheme:dark]"
        />
        {errors.departure && <p className="text-xs text-destructive">{errors.departure}</p>}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="weight"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Load weight (lb)
        </label>
        <Input
          id="weight"
          type="number"
          inputMode="numeric"
          min={1}
          max={80000}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          aria-invalid={!!errors.weight}
          className="font-mono"
        />
        <div className="flex gap-1.5" role="group" aria-label="Quick weights">
          {WEIGHTS.map((w) => (
            <button
              type="button"
              key={w}
              onClick={() => setWeight(String(w))}
              aria-pressed={Number(weight) === w}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors",
                Number(weight) === w
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {w / 1000}k
            </button>
          ))}
        </div>
        {errors.weight && <p className="text-xs text-destructive">{errors.weight}</p>}
      </div>
      <div className="space-y-1.5">
        <span
          id="interval-label"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Checkpoint every
        </span>
        <div
          role="radiogroup"
          aria-labelledby="interval-label"
          className="grid grid-cols-3 rounded-md border bg-muted p-0.5"
        >
          {INTERVALS.map((i) => (
            <button
              type="button"
              role="radio"
              aria-checked={interval === i}
              key={i}
              onClick={() => setInterval(i)}
              className={cn(
                "rounded py-1 text-sm font-medium transition-colors",
                interval === i
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i} mi
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full font-semibold" disabled={analyze.isPending}>
        {analyze.isPending ? <Loader2 className="animate-spin" /> : <RouteIcon />}
        {analyze.isPending ? "Analyzing weather…" : "Find Safest Route"}
      </Button>
      {analyze.isError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive"
        >
          Couldn't analyze routes: {(analyze.error as Error).message}. Please try again.
        </p>
      )}
    </form>
  );
}
