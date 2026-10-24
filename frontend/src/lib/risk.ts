import type { RiskLevel } from "@/types";

/** Display-only colors (hex needed for the map canvas). Mirrors --risk-* tokens in styles.css. */
export const RISK_HEX: Record<RiskLevel, string> = {
  Low: "#22c55e",
  Moderate: "#eab308",
  High: "#f97316",
  Severe: "#ef4444",
  "No Travel": "#7f1d1d",
};

export const RISK_TOKEN: Record<RiskLevel, string> = {
  Low: "risk-low",
  Moderate: "risk-moderate",
  High: "risk-high",
  Severe: "risk-severe",
  "No Travel": "risk-notravel",
};

export const ROUTE_HEX: Record<string, string> = {
  route_a: "#38bdf8",
  route_b: "#f59e0b",
  route_c: "#a3e635",
};

export const ROUTE_LETTER: Record<string, string> = { route_a: "A", route_b: "B", route_c: "C" };

/** Legend thresholds — display only, never used for computation. */
export const THRESHOLDS: { label: string; rows: Record<RiskLevel, string> }[] = [
  {
    label: "Wind (mph)",
    rows: { Low: "<25", Moderate: "25–34", High: "35–44", Severe: "45–54", "No Travel": "≥55" },
  },
  {
    label: "Rain (in/hr)",
    rows: {
      Low: "<0.10",
      Moderate: "0.10–0.25",
      High: "0.25–0.50",
      Severe: "0.50–1.00",
      "No Travel": ">1.00",
    },
  },
  {
    label: "Snow (in/hr)",
    rows: {
      Low: "<0.5",
      Moderate: "0.5–1.0",
      High: "1.0–2.0",
      Severe: "2.0–3.0",
      "No Travel": ">3.0",
    },
  },
];

export const LOAD_RULES = [
  "Wind ≥55 mph → No Travel for any load",
  "Wind 45–54 mph with load >30,000 lb → No Travel",
  "Wind 35–44 mph with load >40,000 lb → Severe",
];

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
