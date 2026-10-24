import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { geocode } from "@/api/routingApi";
import { cn } from "@/lib/utils";
import type { Place } from "@/types";

interface Props {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  error?: string | undefined;
}

export function PlaceAutocomplete({ label, value, onChange, error }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(text), 120);
    return () => clearTimeout(t);
  }, [text]);

  const {
    data = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["geocode", q],
    queryFn: () => geocode(q),
    enabled: open && q.trim().length >= 1 && q !== value?.label,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const pick = (p: Place) => {
    onChange(p);
    setText(p.label);
    setOpen(false);
  };

  return (
    <div className="relative space-y-1">
      <label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <MapPin
          className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open && data.length > 0}
          aria-controls={`${id}-list`}
          aria-invalid={!!error}
          autoComplete="off"
          className={cn("pl-8", error && "border-destructive")}
          value={text}
          placeholder="Start typing a city…"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !data.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, data.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const p = data[active];
              if (p) pick(p);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && data.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border bg-popover shadow-float"
        >
          {data.map((p, i) => (
            <li
              key={p.label}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                i === active && "bg-accent",
              )}
            >
              <MapPin className="size-3.5 text-primary" aria-hidden />
              <span className="font-medium">{p.label.split(", ")[0]}</span>
              <span className="text-muted-foreground">{p.label.split(", ")[1]}</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {isError && !error && (
        <p className="text-xs text-destructive">
          Route service unavailable. Start the Django backend, then try again.
        </p>
      )}
    </div>
  );
}
