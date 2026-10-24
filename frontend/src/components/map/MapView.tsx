/// <reference types="geojson" />
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
type GeoJSONSource = maplibregl.GeoJSONSource;
type MLMap = maplibregl.Map;
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTripStore } from "@/hooks/useTripStore";
import { useHeatmap } from "@/hooks/useHeatmap";
import { MAP_RECOLOR } from "@/lib/mapStyle";
import { RISK_HEX, ROUTE_HEX, ROUTE_LETTER, formatTime } from "@/lib/risk";
import type { Checkpoint, HeatmapPoint, Route } from "@/types";

maplibregl.setWorkerUrl(workerUrl);

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const riskColorExpr = [
  "match",
  ["get", "risk"],
  "Low",
  RISK_HEX.Low,
  "Moderate",
  RISK_HEX.Moderate,
  "High",
  RISK_HEX.High,
  "Severe",
  RISK_HEX.Severe,
  RISK_HEX["No Travel"],
] as unknown as maplibregl.ExpressionSpecification;
const HEAT_WEIGHT = { Low: 0.2, Moderate: 0.4, High: 0.6, Severe: 0.8, "No Travel": 1 };
function popupHtml(c: Checkpoint) {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  return `<div style="font-family:var(--font-sans);font-size:12px;min-width:190px">
    <div style="font-weight:700;font-size:13px">Mile ${c.mile} · ${esc(c.name)}</div>
    <div style="opacity:.75;margin-bottom:6px">ETA ${formatTime(c.eta)}</div>
    <div style="font-family:var(--font-mono)">Wind ${c.wind_mph} mph<br/>Rain ${c.rain_in_hr.toFixed(2)} in/hr<br/>Snow ${c.snow_in_hr.toFixed(1)} in/hr</div>
    <div style="margin-top:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${RISK_HEX[c.risk]};margin-right:4px"></span><b>${c.risk}</b></div>
    <div style="margin-top:2px">${esc(c.driving_factor)}</div></div>`;
}

const SVG: Record<string, string> = {
  rain: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2M16 14v6M8 14v6M12 16v6"/>',
  snow: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
};
const icon = (k: string) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SVG[k]}</svg>`;
function wxEl(c: Checkpoint, i: number) {
  // Display-only icon choice from backend-provided values.
  const k =
    c.snow_in_hr >= 0.3
      ? "snow"
      : c.rain_in_hr >= 0.08
        ? "rain"
        : c.wind_mph >= 25
          ? "wind"
          : "cloud";
  const wrap = document.createElement("div");
  const d = document.createElement("div");
  d.className =
    "animate-wx flex items-center gap-1 rounded-full border bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-float backdrop-blur";
  d.style.animationDelay = `${(i % 5) * -0.6}s`;
  d.innerHTML = `<span style="color:${RISK_HEX[c.risk]}">${icon(k)}</span>${k === "snow" ? c.snow_in_hr.toFixed(1) + '"' : k === "rain" ? c.rain_in_hr.toFixed(2) + '"' : c.wind_mph + " mph"}`;
  wrap.appendChild(d);
  return wrap;
}

const heatFC = (pts: HeatmapPoint[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: pts.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    properties: { risk: p.risk, value: p.value, weight: HEAT_WEIGHT[p.risk] },
  })),
});

export default function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const heatSlot = useRef<"a" | "b">("a");
  const lastResult = useRef<unknown>(null);

  const result = useTripStore((s) => s.result);
  const selectedId = useTripStore((s) => s.selectedRouteId);
  const hidden = useTripStore((s) => s.hiddenRoutes);
  const focused = useTripStore((s) => s.focusedCheckpoint);
  const heatOn = useTripStore((s) => s.heatmapOn);
  const { data: heat } = useHeatmap();
  const poi = useTripStore((s) => s.poi);
  const mobileView = useTripStore((s) => s.mobileView);
  const selRoute = result?.routes.find((r) => r.id === selectedId);
  const wxMarkers = useRef<maplibregl.Marker[]>([]);
  const drawRef = useRef<number>(0);
  const motorwayOrig = useRef<Record<string, unknown>>({});

  // Init once
  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [-96, 39],
      zoom: 3.6,
      minZoom: 3,
      maxBounds: [
        [-128, 22],
        [-64, 51],
      ],
      renderWorldCopies: false,
      attributionControl: { compact: true },
    });
    // OpenFreeMap occasionally references an optional numbered-circle sprite
    // before its sprite sheet arrives. MapLibre awaits this resolver, unlike a
    // styleimagemissing listener which runs after it has already logged a warning.
    map.setMissingStyleImageResolver((imageId) => {
      if (!imageId.startsWith("circle-") || map.hasImage(imageId)) return;
      map.addImage(imageId, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      // Repaint the near-black base style so land, water, roads and labels read clearly.
      const setPaint = (
        map.setPaintProperty as unknown as (id: string, name: string, value: unknown) => void
      ).bind(map);
      for (const [id, paint] of Object.entries(MAP_RECOLOR)) {
        for (const [prop, value] of Object.entries(paint)) setPaint(id, prop, value);
      }
      for (const s of ["heat-a", "heat-b"]) {
        map.addSource(s, { type: "geojson", data: EMPTY });
        map.addLayer({
          id: s,
          type: "heatmap",
          source: s,
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 2.2],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 20, 8, 105],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.16, "#22c55e",
              0.38, "#eab308",
              0.62, "#f97316",
              0.82, "#ef4444",
              1, "#a855f7",
            ],
            "heatmap-opacity": 0,
            "heatmap-opacity-transition": { duration: 350 },
          },
        });
      }
      map.addSource("routes", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["get", "selected"], 10, 5],
          "line-opacity": ["case", ["get", "selected"], 0.95, 0.55],
        },
      });
      map.addSource("segments", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "segments-line",
        type: "line",
        source: "segments",
        filter: ["!=", ["get", "risk"], "No Travel"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": riskColorExpr,
          "line-width": ["case", ["get", "selected"], 6, 3],
          "line-opacity": ["case", ["get", "selected"], 0.96, 0.55],
        },
      });
      map.addLayer({
        id: "segments-notravel",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "risk"], "No Travel"],
        paint: { "line-color": "#0a0a0a", "line-width": 6, "line-dasharray": [1, 1] },
      });
      map.addLayer(
        {
          id: "segments-notravel-under",
          type: "line",
          source: "segments",
          filter: ["==", ["get", "risk"], "No Travel"],
          paint: { "line-color": RISK_HEX["No Travel"], "line-width": 6 },
        },
        "segments-notravel",
      );
      map.addSource("checkpoints", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "checkpoints",
        type: "circle",
        source: "checkpoints",
        paint: {
          "circle-color": riskColorExpr,
          "circle-radius": 5.5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.on("click", "checkpoints", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const c = JSON.parse(f.properties["cp"] as string) as Checkpoint;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ offset: 10 })
          .setLngLat([c.lng, c.lat])
          .setHTML(popupHtml(c))
          .addTo(map);
      });
      map.on("mouseenter", "checkpoints", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "checkpoints", () => (map.getCanvas().style.cursor = ""));
      setReady(true);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Routes / segments / checkpoints
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const routes = result?.routes ?? [];
    const visible = routes.filter((r) => !hidden[r.id]);
    const order = [...visible].sort((a) => (a.id === selectedId ? 1 : -1));
    const fc = (t: number): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: order.map((r) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: r.geometry.slice(0, Math.max(2, Math.ceil(r.geometry.length * t))),
        },
        properties: {
          id: r.id,
          color: ROUTE_HEX[r.id] ?? "#94a3b8",
          selected: r.id === selectedId,
        },
      })),
    });
    const src = map.getSource("routes") as GeoJSONSource;
    cancelAnimationFrame(drawRef.current);
    if (result !== lastResult.current && routes.length) {
      lastResult.current = result;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 1400);
        const e = 1 - Math.pow(1 - t, 3);
        src.setData(fc(e));
        if (t < 1) drawRef.current = requestAnimationFrame(step);
      };
      drawRef.current = requestAnimationFrame(step);
    } else src.setData(fc(1));
    (map.getSource("segments") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: visible.flatMap((route) =>
        route.segments.map((s) => ({
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: s.coordinates },
          properties: { risk: s.risk, selected: route.id === selectedId },
        })),
      ),
    });
    (map.getSource("checkpoints") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: visible.flatMap((route) =>
        route.checkpoints.map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
          properties: { risk: c.risk, cp: JSON.stringify(c), selected: route.id === selectedId },
        })),
      ),
    });
  }, [ready, result, selectedId, hidden]);

  // Markers + fit bounds on new result
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !result?.routes.length) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const first = result.routes[0]!.geometry;
    const mk = (cls: string, text: string, label: string) => {
      const d = document.createElement("div");
      d.className = cls;
      d.textContent = text;
      d.setAttribute("aria-label", label);
      return d;
    };
    const o = first[0]!,
      dEnd = first[first.length - 1]!;
    markersRef.current.push(
      new maplibregl.Marker({
        element: mk(
          "grid size-7 place-items-center rounded-full border-2 border-background bg-foreground text-xs font-bold text-background",
          "O",
          "Origin",
        ),
      })
        .setLngLat(o)
        .addTo(map),
      new maplibregl.Marker({
        element: mk(
          "grid size-7 place-items-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground",
          "D",
          "Destination",
        ),
      })
        .setLngLat(dEnd)
        .addTo(map),
    );
    const rec = result.routes.find((r) => r.id === result.recommended_route_id);
    if (rec) {
      const mid = rec.geometry[Math.floor(rec.geometry.length / 2)]!;
      markersRef.current.push(
        new maplibregl.Marker({
          element: mk(
            "rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-float",
            `★ Route ${ROUTE_LETTER[rec.id]}`,
            "Recommended route",
          ),
          anchor: "bottom",
          offset: [0, -8],
        })
          .setLngLat(mid)
          .addTo(map),
      );
    }
    const b = new maplibregl.LngLatBounds();
    result.routes.forEach((r) => r.geometry.forEach((p) => b.extend(p)));
    map.fitBounds(b, { padding: { top: 60, bottom: 140, left: 50, right: 50 }, duration: 800 });
  }, [ready, result]);

  // Fly to checkpoint
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focused || !result) return;
    const c = result.routes
      .find((r) => r.id === focused.routeId)
      ?.checkpoints.find((x) => x.mile === focused.mile);
    if (!c) return;
    map.flyTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 7.5), duration: 900 });
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ offset: 10 })
      .setLngLat([c.lng, c.lat])
      .setHTML(popupHtml(c))
      .addTo(map);
  }, [ready, focused, result]);

  // Heatmap cross-fade between two sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!heatOn || !heat) {
      map.setPaintProperty("heat-a", "heatmap-opacity", 0);
      map.setPaintProperty("heat-b", "heatmap-opacity", 0);
      return;
    }
    const next = heatSlot.current === "a" ? "b" : "a";
    (map.getSource(`heat-${next}`) as GeoJSONSource).setData(heatFC(heat.points));
    map.setPaintProperty(`heat-${next}`, "heatmap-opacity", 0.62);
    map.setPaintProperty(`heat-${heatSlot.current}`, "heatmap-opacity", 0);
    heatSlot.current = next;
  }, [ready, heat, heatOn]);

  // Animated weather icons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    wxMarkers.current.forEach((m) => m.remove());
    wxMarkers.current = [];
    if (!poi.weather || !selRoute || hidden[selRoute.id]) return;
    const cps = selRoute.checkpoints;
    const every = Math.max(1, Math.ceil(cps.length / 10));
    cps
      .filter((_, i) => i % every === 0)
      .forEach((c, i) => {
        wxMarkers.current.push(
          new maplibregl.Marker({ element: wxEl(c, i), anchor: "bottom", offset: [0, -10] })
            .setLngLat([c.lng, c.lat])
            .addTo(map),
        );
      });
  }, [ready, poi.weather, selRoute, hidden]);

  // Interstate highlighting — only while the Interstates pill is on.
  // Off: motorway lines fade back to a muted slate and the route-number labels
  // are hidden. On: lines go bright blue with a deep-blue casing and the
  // interstate number labels come back.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const setPaint = (
      map.setPaintProperty as unknown as (id: string, name: string, value: unknown) => void
    ).bind(map);
    const setLayout = (
      map.setLayoutProperty as unknown as (id: string, name: string, value: unknown) => void
    ).bind(map);
    for (const l of map.getStyle().layers ?? []) {
      if (!/motorway/.test(l.id)) continue;
      if (l.type === "line") {
        if (!(l.id in motorwayOrig.current))
          motorwayOrig.current[l.id] = map.getPaintProperty(l.id, "line-color");
        const orig = motorwayOrig.current[l.id] as string;
        const on = poi.interstates;
        if (/casing/.test(l.id)) setPaint(l.id, "line-color", on ? "#123f78" : orig);
        else if (/inner/.test(l.id)) setPaint(l.id, "line-color", on ? "#60a5fa" : "#5d7194");
        else setPaint(l.id, "line-color", on ? "#4a8ef5" : "#3d5480");
      } else if (l.type === "symbol") {
        // Route/interstate numbers only appear when the pill is clicked.
        setLayout(l.id, "visibility", poi.interstates ? "visible" : "none");
      }
    }
  }, [ready, poi.interstates]);

  // Resize when shown on mobile
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 60);
    return () => clearTimeout(t);
  }, [mobileView]);

  return (
    <div className="absolute inset-0" role="region" aria-label="Route map">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
