import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Map as MapIcon, Route as RouteIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TripForm } from "@/components/TripForm";
import { ResultsPanel } from "@/components/ResultsPanel";
import { RiskInfo } from "@/components/RiskInfo";
import { MapControls, MapLegend, MapToolbar, TimeSlider } from "@/components/map/MapOverlays";
import { useTripStore } from "@/hooks/useTripStore";
import { USING_MOCKS } from "@/api/routingApi";
import { cn } from "@/lib/utils";

const MapView = lazy(() => import("@/components/map/MapView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spotter Labs — Weather-Aware Truck Routing" },
      {
        name: "description",
        content:
          "Compare truck routes by forecast wind, rain, snow and load weight to pick the safest drive.",
      },
      { property: "og:title", content: "SafeHaul — Weather-Aware Truck Routing" },
      {
        property: "og:description",
        content:
          "Compare truck routes by forecast wind, rain, snow and load weight to pick the safest drive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function DevNoTravelToggle() {
  const v = useTripStore((s) => s.simulateNoTravel);
  const set = useTripStore((s) => s.setSimulateNoTravel);
  if (!import.meta.env.DEV || !USING_MOCKS) return null;
  return (
    <label className="flex items-center justify-between rounded-md border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground">
      Dev: simulate No Travel (wind ≥55 mph) — re-run search
      <Switch checked={v} onCheckedChange={set} aria-label="Simulate No Travel scenario" />
    </label>
  );
}

function MobileSwitch() {
  const view = useTripStore((s) => s.mobileView);
  const set = useTripStore((s) => s.setMobileView);
  const has = useTripStore((s) => !!s.result);
  const items = [
    { id: "plan" as const, label: "Trip planner", icon: RouteIcon },
    { id: "map" as const, label: "Map", icon: MapIcon },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-sidebar/95 px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md split:hidden"
      aria-label="Switch view"
    >
      <div className="relative grid grid-cols-2 rounded-2xl bg-secondary p-1">
        <span
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-primary shadow-md transition-transform duration-300 ease-out",
            view === "map" && "translate-x-full",
          )}
          aria-hidden
        />
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => set(id)}
            aria-pressed={view === id}
            className={cn(
              "relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors",
              view === id ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {id === "map" && has && view !== "map" && (
              <span
                className="size-2 animate-pulse rounded-full bg-success"
                aria-label="routes ready"
              />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Index() {
  const view = useTripStore((s) => s.mobileView);
  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col overflow-hidden bg-background split:flex-row">
      <aside
        className={cn(
          "h-full w-full shrink-0 flex-col border-sidebar-border bg-sidebar pb-20 split:flex split:w-[340px] split:border-r split:pb-0 lg:w-[420px] xl:w-[440px]",
          view === "plan" ? "flex animate-in fade-in slide-in-from-left-4 duration-300" : "hidden",
        )}
        aria-label="Trip planner"
      >
        <header className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <RouteIcon className="size-4" aria-hidden />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold leading-none tracking-tight">Trip planner</h1>
            <p className="mt-1 text-xs text-muted-foreground">Weather-aware routing</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Live
          </span>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <TripForm />
          <DevNoTravelToggle />
          <ResultsPanel />
          <RiskInfo />
        </div>
      </aside>
      <main
        className={cn(
          "relative flex-1 pb-[4.5rem] split:block split:p-3 split:pb-3",
          view === "map" ? "block" : "hidden",
        )}
      >
        <div className="relative h-full overflow-hidden split:rounded-2xl split:border">
          <ClientOnly fallback={<div className="absolute inset-0 animate-pulse bg-muted" />}>
            <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-muted" />}>
              <MapView />
            </Suspense>
          </ClientOnly>
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-2 p-3 pb-12">
            <div className="flex flex-col items-start gap-2">
              <div className="pointer-events-auto max-w-full self-center pr-10">
                <MapToolbar />
              </div>
              <div className="pointer-events-auto hidden sm:block">
                <MapControls />
              </div>
            </div>
            <div className="flex flex-col gap-2 split:flex-row split:items-end">
              <div className="pointer-events-auto hidden sm:block">
                <MapLegend />
              </div>
              <div className="pointer-events-auto flex-1 split:mr-10">
                <TimeSlider />
              </div>
            </div>
          </div>
        </div>
      </main>
      <MobileSwitch />
    </div>
  );
}
