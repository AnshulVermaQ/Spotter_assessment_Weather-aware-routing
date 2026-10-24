// Mock backend. Risk values here are hard-coded fixtures standing in for backend output.
import type {
  Checkpoint,
  HeatmapLayer,
  HeatmapPoint,
  HeatmapResponse,
  LngLat,
  Place,
  RiskLevel,
  Route,
  RouteSegment,
  TripRequest,
  TripResponse,
} from "@/types";
import { US_CITIES } from "./usCities";

export const MOCK_PLACES: Place[] = [
  { label: "Chicago, IL", lat: 41.88, lng: -87.63 },
  { label: "Denver, CO", lat: 39.74, lng: -104.99 },
  { label: "Omaha, NE", lat: 41.26, lng: -95.94 },
  { label: "Kansas City, MO", lat: 39.1, lng: -94.58 },
  { label: "Des Moines, IA", lat: 41.59, lng: -93.62 },
  { label: "St. Louis, MO", lat: 38.63, lng: -90.2 },
  { label: "Minneapolis, MN", lat: 44.98, lng: -93.27 },
  { label: "Cheyenne, WY", lat: 41.14, lng: -104.82 },
  { label: "Salt Lake City, UT", lat: 40.76, lng: -111.89 },
  { label: "Indianapolis, IN", lat: 39.77, lng: -86.16 },
  { label: "Dallas, TX", lat: 32.78, lng: -96.8 },
  { label: "Wichita, KS", lat: 37.69, lng: -97.34 },
];

const WAYPOINTS: Record<
  string,
  { summary: string; pts: [number, number, string][]; speed: number }
> = {
  route_a: {
    summary: "via I-80 W",
    speed: 68,
    pts: [
      [-87.63, 41.88, "Chicago, IL"],
      [-90.58, 41.52, "Davenport, IA"],
      [-93.62, 41.59, "Des Moines, IA"],
      [-95.94, 41.26, "Omaha, NE"],
      [-98.34, 40.92, "Grand Island, NE"],
      [-100.77, 41.12, "North Platte, NE"],
      [-102.98, 40.99, "Julesburg, CO"],
      [-104.99, 39.74, "Denver, CO"],
    ],
  },
  route_b: {
    summary: "via I-88 W / I-76",
    speed: 62,
    pts: [
      [-87.63, 41.88, "Chicago, IL"],
      [-89.09, 41.9, "Dixon, IL"],
      [-91.53, 41.66, "Iowa City, IA"],
      [-94.9, 41.4, "Atlantic, IA"],
      [-96.68, 40.81, "Lincoln, NE"],
      [-99.08, 40.7, "Kearney, NE"],
      [-101.7, 40.6, "Imperial, NE"],
      [-103.8, 40.25, "Fort Morgan, CO"],
      [-104.99, 39.74, "Denver, CO"],
    ],
  },
  route_c: {
    summary: "via I-55 S / I-70 W",
    speed: 64,
    pts: [
      [-87.63, 41.88, "Chicago, IL"],
      [-89.64, 39.8, "Springfield, IL"],
      [-90.2, 38.63, "St. Louis, MO"],
      [-92.33, 38.95, "Columbia, MO"],
      [-94.58, 39.1, "Kansas City, MO"],
      [-97.61, 38.84, "Salina, KS"],
      [-100.87, 39.35, "Colby, KS"],
      [-103.2, 39.3, "Limon, CO"],
      [-104.99, 39.74, "Denver, CO"],
    ],
  },
};

// risk profile per route as fraction-of-route ranges
const PROFILES: Record<
  string,
  { from: number; to: number; risk: RiskLevel; wind: number; rain: number; snow: number }[]
> = {
  route_a: [
    { from: 0.4, to: 0.52, risk: "Moderate", wind: 30, rain: 0.12, snow: 0 },
    { from: 0.52, to: 0.6, risk: "High", wind: 37, rain: 0.2, snow: 0 },
    { from: 0.6, to: 0.64, risk: "Severe", wind: 41, rain: 0.3, snow: 0.2 },
    { from: 0.64, to: 0.72, risk: "High", wind: 36, rain: 0.1, snow: 0.4 },
  ],
  route_b: [
    { from: 0.3, to: 0.45, risk: "Moderate", wind: 27, rain: 0.15, snow: 0 },
    { from: 0.55, to: 0.68, risk: "High", wind: 36, rain: 0.28, snow: 0 },
    { from: 0.8, to: 0.88, risk: "Moderate", wind: 29, rain: 0, snow: 0.6 },
  ],
  route_c: [{ from: 0.7, to: 0.78, risk: "Moderate", wind: 26, rain: 0.05, snow: 0 }],
};

const NO_TRAVEL_PROFILE = {
  from: 0.62,
  to: 0.68,
  risk: "No Travel" as RiskLevel,
  wind: 56,
  rain: 0.1,
  snow: 0,
};

const SCORE: Record<RiskLevel, number> = {
  Low: 1,
  Moderate: 2,
  High: 3,
  Severe: 4,
  "No Travel": 5,
};

function haversine(a: LngLat, b: LngLat) {
  const R = 3958.8,
    toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR,
    dLng = (b[0] - a[0]) * toR;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Densify waypoints into a geometry with slight wiggle for realism. */
function densify(pts: [number, number, string][]): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i],
      [x2, y2] = pts[i + 1];
    const n = 12;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const w = Math.sin(t * Math.PI) * 0.06 * Math.sin(i * 3.1 + k);
      out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + w]);
    }
  }
  const last = pts[pts.length - 1];
  out.push([last[0], last[1]]);
  return out;
}

function nearestName(pts: [number, number, string][], p: LngLat) {
  let best = pts[0][2],
    d = Infinity;
  for (const w of pts) {
    const dd = haversine([w[0], w[1]], p);
    if (dd < d) {
      d = dd;
      best = w[2];
    }
  }
  return d < 15 ? best : `${Math.round(d)} mi from ${best}`;
}

function buildRoute(id: string, req: TripRequest, noTravel: boolean): Route {
  const cfg = WAYPOINTS[id];
  const geom = densify(cfg.pts);
  const cum = [0];
  for (let i = 1; i < geom.length; i++) cum.push(cum[i - 1] + haversine(geom[i - 1], geom[i]));
  const total = cum[cum.length - 1];
  const profile = [...PROFILES[id]];
  if (noTravel && id === "route_a") profile.push(NO_TRAVEL_PROFILE);
  if (noTravel && id === "route_b")
    profile.push({ ...NO_TRAVEL_PROFILE, from: 0.58, to: 0.63, wind: 57 });

  const riskAt = (f: number) => {
    let r = {
      risk: "Low" as RiskLevel,
      wind: 12 + 8 * Math.abs(Math.sin(f * 20)),
      rain: 0.02,
      snow: 0,
    };
    for (const p of profile) if (f >= p.from && f < p.to && SCORE[p.risk] >= SCORE[r.risk]) r = p;
    return r;
  };

  const segments: RouteSegment[] = [];
  const miles: Record<RiskLevel, number> = {
    Low: 0,
    Moderate: 0,
    High: 0,
    Severe: 0,
    "No Travel": 0,
  };
  let scoreSum = 0;
  for (let i = 1; i < geom.length; i++) {
    const f = cum[i - 1] / total;
    const { risk } = riskAt(f);
    const segLen = cum[i] - cum[i - 1];
    miles[risk] += segLen;
    scoreSum += SCORE[risk] * segLen;
    const last = segments[segments.length - 1];
    if (last && last.risk === risk) last.coordinates.push(geom[i]);
    else segments.push({ risk, coordinates: [geom[i - 1], geom[i]] });
  }
  (Object.keys(miles) as RiskLevel[]).forEach((k) => (miles[k] = Math.round(miles[k])));

  const dep = new Date(req.departure_time).getTime();
  const durationMin = Math.round((total / cfg.speed) * 60);
  const checkpoints: Checkpoint[] = [];
  const step = req.checkpoint_interval_miles;
  let gi = 0;
  for (let m = step; m < total; m += step) {
    while (gi < cum.length - 1 && cum[gi + 1] < m) gi++;
    const t = (m - cum[gi]) / (cum[gi + 1] - cum[gi] || 1);
    const p: LngLat = [
      geom[gi][0] + (geom[gi + 1][0] - geom[gi][0]) * t,
      geom[gi][1] + (geom[gi + 1][1] - geom[gi][1]) * t,
    ];
    const r = riskAt(m / total);
    const wind = Math.round(r.wind);
    const load = req.load_weight_lb.toLocaleString();
    let factor = "Conditions clear";
    if (r.risk === "No Travel") factor = `Wind ${wind} mph ≥ 55 → No Travel (any load)`;
    else if (r.risk === "Severe") factor = `Wind ${wind} mph + ${load} lb load → Severe`;
    else if (r.risk === "High")
      factor =
        r.rain >= 0.25 ? `Rain ${r.rain.toFixed(2)} in/hr → High` : `Wind ${wind} mph → High`;
    else if (r.risk === "Moderate")
      factor =
        r.snow >= 0.5
          ? `Snow ${r.snow.toFixed(1)} in/hr → Moderate`
          : r.rain >= 0.1
            ? `Rain ${r.rain.toFixed(2)} in/hr → Moderate`
            : `Wind ${wind} mph → Moderate`;
    checkpoints.push({
      mile: m,
      lat: +p[1].toFixed(3),
      lng: +p[0].toFixed(3),
      name: nearestName(cfg.pts, p),
      eta: new Date(dep + (m / cfg.speed) * 3600000).toISOString(),
      wind_mph: wind,
      wind_gust_mph: wind,
      rain_in_hr: +r.rain.toFixed(2),
      snow_in_hr: +r.snow.toFixed(1),
      risk: r.risk,
      driving_factor: factor,
    });
  }

  const overall =
    (["No Travel", "Severe", "High", "Moderate", "Low"] as RiskLevel[]).find((k) => miles[k] > 0) ??
    "Low";
  const ntCp = checkpoints.find((c) => c.risk === "No Travel");
  return {
    id,
    summary: cfg.summary,
    distance_miles: Math.round(total),
    duration_minutes: durationMin,
    eta: new Date(dep + durationMin * 60000).toISOString(),
    overall_risk: overall,
    no_travel: overall === "No Travel",
    no_travel_reason: ntCp ? `Wind ${ntCp.wind_mph} mph at mile ${ntCp.mile} (${ntCp.name})` : null,
    avg_risk_score: +(scoreSum / total).toFixed(2),
    miles_by_risk: miles,
    geometry: geom,
    segments,
    checkpoints,
  };
}

export function mockAnalyze(req: TripRequest, noTravel: boolean): TripResponse {
  const routes = ["route_a", "route_b", "route_c"].map((id) => buildRoute(id, req, noTravel));
  const viable = routes.filter((r) => !r.no_travel);
  const best = [...viable].sort(
    (a, b) =>
      a.miles_by_risk.Severe - b.miles_by_risk.Severe ||
      a.avg_risk_score - b.avg_risk_score ||
      a.duration_minutes - b.duration_minutes,
  )[0];
  const fastest = [...routes].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  const letter = (id: string) => id.slice(-1).toUpperCase();
  let reason = "No route is safe to travel in this window. Consider delaying departure.";
  if (best) {
    const diff = best.duration_minutes - fastest.duration_minutes;
    reason =
      `Lowest risk: ${best.miles_by_risk.Severe} Severe mi, ${best.miles_by_risk.High} High mi, avg score ${best.avg_risk_score}.` +
      (diff > 0
        ? ` ${Math.floor(diff / 60) ? Math.floor(diff / 60) + "h " : ""}${diff % 60} min slower than Route ${letter(fastest.id)}.`
        : " Also the fastest option.");
  }
  return {
    trip_id: "mock-trip",
    recommended_route_id: best?.id ?? null,
    recommendation_reason: reason,
    routes,
  };
}

export function mockGeocode(q: string): Place[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const seen = new Set<string>();
  const all: Place[] = [
    ...MOCK_PLACES,
    ...US_CITIES.map(([label, lat, lng]) => ({ label, lat, lng })),
  ].filter((p) => !seen.has(p.label) && seen.add(p.label));
  const starts = all.filter((p) => p.label.toLowerCase().startsWith(s));
  const words = all.filter(
    (p) =>
      !p.label.toLowerCase().startsWith(s) &&
      p.label
        .toLowerCase()
        .split(/[\s,]+/)
        .some((w) => w.startsWith(s)),
  );
  return [...starts, ...words].slice(0, 8);
}

/** Corridor-only grid with moving weather blobs so the slider visibly animates. */
export function mockHeatmap(
  routes: Route[],
  hour: number,
  layer: HeatmapLayer,
  departure: string,
): HeatmapResponse {
  const pts: HeatmapPoint[] = [];
  const seen = new Set<string>();
  const step = 0.35;
  for (const r of routes) {
    for (let i = 0; i < r.geometry.length; i += 2) {
      const [lng, lat] = r.geometry[i];
      for (let dx = -2; dx <= 2; dx++)
        for (let dy = -2; dy <= 2; dy++) {
          const gx = Math.round(lng / step) + dx,
            gy = Math.round(lat / step) + dy;
          const key = `${gx},${gy}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pts.push({ lng: gx * step, lat: gy * step, value: 0, risk: "Low" });
        }
    }
  }
  const blobs = [
    { x: -100 + hour * 0.18, y: 41 + Math.sin(hour / 6) * 0.8, s: 1.6, amp: 1 },
    { x: -93 + hour * 0.12, y: 40 + Math.cos(hour / 8), s: 1.2, amp: 0.7 },
    { x: -105 + hour * 0.25, y: 39.5, s: 1.0, amp: 0.85 },
  ];
  const max = { wind: 60, rain: 1.1, snow: 3.2, combined: 5 }[layer];
  const cuts = {
    wind: [25, 35, 45, 55],
    rain: [0.1, 0.25, 0.5, 1.0],
    snow: [0.5, 1, 2, 3],
    combined: [1.5, 2.5, 3.5, 4.5],
  }[layer];
  const layerShift = { wind: 0, rain: 1.3, snow: 2.6, combined: 0.5 }[layer];
  for (const p of pts) {
    let v = 0;
    blobs.forEach((b, i) => {
      const bx = b.x + (i === 0 ? layerShift : -layerShift * 0.5);
      const d2 = (p.lng - bx) ** 2 / (b.s * 1.8) ** 2 + (p.lat - b.y) ** 2 / b.s ** 2;
      v += b.amp * Math.exp(-d2);
    });
    const value = Math.min(max, v * max * 0.95 + (layer === "wind" ? 8 : 0));
    p.value = +value.toFixed(2);
    const idx = cuts.findIndex((c) => value < c);
    p.risk = (["Low", "Moderate", "High", "Severe", "No Travel"] as RiskLevel[])[
      idx === -1 ? 4 : idx
    ];
  }
  return {
    hour,
    valid_time: new Date(new Date(departure).getTime() + hour * 3600000).toISOString(),
    points: pts.filter((p) => p.risk !== "Low" || p.value > max * 0.15),
  };
}
