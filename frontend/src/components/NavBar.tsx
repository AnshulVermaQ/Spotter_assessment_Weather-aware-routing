import { Link } from "@tanstack/react-router";
import { Home, ListTree, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-all duration-200 active:scale-95 sm:px-3";
const active = "bg-primary/15 text-foreground shadow-inner";
const idle = "text-muted-foreground hover:bg-accent hover:text-foreground";

export function NavBar() {
  return (
    <nav
      className="animate-in fade-in slide-in-from-top-2 z-40 h-[var(--nav-h)] shrink-0 border-b bg-sidebar/90 backdrop-blur-md duration-500"
      aria-label="Main"
    >
      <div className="mx-auto grid h-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5">
        <Link to="/" className="group flex items-center gap-2" activeOptions={{ exact: true }}>
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-transform duration-300 group-hover:-rotate-6">
            <img src="/favicon.ico" className="h-8 w-8" alt="Spotter Labs Logo" />
          </span>
          <span className="hidden text-md font-bold tracking-tight sm:inline">Spotter Labs</span>
        </Link>

        <div className="flex items-center justify-center gap-1.5">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: cn(base, active) }}
            inactiveProps={{ className: cn(base, idle) }}
          >
            <Home className="size-4" aria-hidden />
            Home
          </Link>
          <Link
            to="/route-overview"
            activeProps={{ className: cn(base, active) }}
            inactiveProps={{ className: cn(base, idle) }}
          >
            <ListTree className="size-4" aria-hidden />
            Route overview
          </Link>
        </div>

        <div aria-hidden />
      </div>
    </nav>
  );
}
