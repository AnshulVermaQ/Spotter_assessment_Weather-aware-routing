import { AlertOctagon, AlertTriangle, CheckCircle2, CircleAlert, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

const STYLES: Record<RiskLevel, string> = {
  Low: "bg-risk-low/15 text-risk-low border-risk-low/40",
  Moderate: "bg-risk-moderate/15 text-risk-moderate border-risk-moderate/40",
  High: "bg-risk-high/15 text-risk-high border-risk-high/40",
  Severe: "bg-risk-severe/15 text-risk-severe border-risk-severe/50",
  "No Travel": "bg-risk-notravel text-primary-foreground border-risk-severe",
};

const ICONS = {
  Low: CheckCircle2,
  Moderate: CircleAlert,
  High: AlertTriangle,
  Severe: AlertOctagon,
  "No Travel": Ban,
};

export const RISK_DOT: Record<RiskLevel, string> = {
  Low: "bg-risk-low",
  Moderate: "bg-risk-moderate",
  High: "bg-risk-high",
  Severe: "bg-risk-severe",
  "No Travel": "hatch-notravel",
};

export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  const Icon = ICONS[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        STYLES[risk],
        className,
      )}
      aria-label={`Risk: ${risk}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {risk}
    </span>
  );
}
