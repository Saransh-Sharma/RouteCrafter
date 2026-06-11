"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Plus } from "lucide-react";
import { navItems } from "./nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border-soft bg-paper/70 px-4 py-6 backdrop-blur-sm lg:flex">
      <Brand />

      <Link
        href="/projects/new"
        className="mt-8 flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep"
      >
        <Plus className="size-4" />
        New project
      </Link>

      <nav className="mt-8 flex flex-col gap-1">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Studio
        </p>
        {navItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sage-soft text-forest"
                  : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-border-soft bg-paper-2/50 p-4">
        <p className="text-xs font-semibold text-ink">Prompt-output mode</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Works without API keys. Connect a model later to generate in-app.
        </p>
      </div>
    </aside>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-forest text-paper shadow-[var(--shadow-soft)]">
        <Compass className="size-5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-semibold text-ink">
          RouteCrafter
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          Itinerary Studio
        </span>
      </span>
    </Link>
  );
}
