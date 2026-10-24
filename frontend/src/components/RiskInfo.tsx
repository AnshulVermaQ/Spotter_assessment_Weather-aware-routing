import { ChevronDown, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LOAD_RULES, THRESHOLDS } from "@/lib/risk";
import { RISK_LEVELS } from "@/types";
import { RISK_DOT } from "./RiskBadge";

export function RiskInfo() {
  return (
    <Collapsible className="rounded-lg border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Info className="size-4 text-primary" aria-hidden />
          How risk is calculated
        </span>
        <ChevronDown
          className="size-4 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t px-3 py-3 text-xs">
        <p className="text-muted-foreground">
          Risk is computed by the routing service at each checkpoint from forecast weather at your
          ETA. The worst factor wins.
        </p>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground" />
              {RISK_LEVELS.map((r) => (
                <th key={r} className="px-1 text-center font-medium">
                  <span
                    className={`mx-auto mb-0.5 block h-1.5 w-6 rounded ${RISK_DOT[r]}`}
                    aria-hidden
                  />
                  {r === "No Travel" ? "No Trv" : r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {THRESHOLDS.map((t) => (
              <tr key={t.label}>
                <td className="py-1 pr-1 font-sans text-muted-foreground">{t.label}</td>
                {RISK_LEVELS.map((r) => (
                  <td key={r} className="px-1 text-center">
                    {t.rows[r]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <h4 className="mb-1 font-semibold">Load-weight escalations</h4>
          <ul className="list-disc space-y-0.5 pl-4">
            {LOAD_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
