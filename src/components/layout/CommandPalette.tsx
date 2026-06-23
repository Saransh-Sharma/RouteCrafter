"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Command,
  FileDown,
  FolderOpen,
  LibraryBig,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { navItems } from "./nav";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  hint: string;
  run: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => {
          const next = !value;
          if (next) setActive(0);
          return next;
        });
      } else if (event.key === "Escape") {
        setOpen(false);
      } else if (!inInput && event.key === "g") {
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const projectId = projectMatch === "new" ? undefined : projectMatch;
  const commands = React.useMemo<CommandItem[]>(
    () => [
      ...navItems.map((item) => ({
        id: `nav-${item.href}`,
        label: item.label,
        group: "Navigate",
        hint: item.href,
        icon: item.icon,
        run: () => router.push(item.href),
      })),
      {
        id: "new-project",
        label: "New project",
        group: "Create",
        hint: "/projects/new",
        icon: Plus,
        run: () => router.push("/projects/new"),
      },
      {
        id: "templates",
        label: "Use a template",
        group: "Create",
        hint: "/templates",
        icon: LibraryBig,
        run: () => router.push("/templates"),
      },
      {
        id: "settings-ai",
        label: "AI settings",
        group: "AI",
        hint: "Provider keys",
        icon: Settings,
        run: () => router.push("/settings"),
      },
      ...(projectId
        ? [
            {
              id: "workspace-plan",
              label: "Jump to Plan",
              group: "Workspace",
              hint: "Route and editions",
              icon: FolderOpen,
              run: () => router.push(`/projects/${projectId}?stage=plan`),
            },
            {
              id: "workspace-build",
              label: "Jump to Build",
              group: "Workspace",
              hint: "Itinerary tools",
              icon: Sparkles,
              run: () => router.push(`/projects/${projectId}?stage=build`),
            },
            {
              id: "workspace-export",
              label: "Jump to PDF export",
              group: "Workspace",
              hint: "Package stage",
              icon: FileDown,
              run: () =>
                router.push(`/projects/${projectId}?stage=package&tool=pdf`),
            },
          ]
        : []),
    ],
    [projectId, router],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? commands.filter((item) =>
        `${item.label} ${item.group} ${item.hint}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : commands;
  const activeIndex = Math.min(active, Math.max(filtered.length - 1, 0));
  const activeOptionId = filtered[activeIndex]
    ? `command-option-${filtered[activeIndex].id}`
    : undefined;
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] ?? []), item];
    return acc;
  }, {});

  if (!mounted || !open) return null;

  function run(item: CommandItem) {
    item.run();
    setOpen(false);
    setQuery("");
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/35 px-3 pt-[12dvh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 w-full max-w-2xl overflow-hidden rounded-2xl border border-border-strong bg-paper shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
          <Search className="size-4 text-ink-muted" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && filtered[activeIndex]) {
                event.preventDefault();
                run(filtered[activeIndex]);
              }
            }}
            placeholder="Search commands"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          <span className="hidden items-center gap-1 rounded-full border border-border-soft px-2 py-1 text-[11px] text-ink-muted sm:inline-flex">
            <Command className="size-3" /> K
          </span>
        </div>
        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Commands"
          className="max-h-[55dvh] overflow-y-auto p-2"
        >
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="py-1">
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {group}
              </p>
              {items.map((item) => {
                const flatIndex = filtered.findIndex(
                  (candidate) => candidate.id === item.id,
                );
                const Icon = item.icon;
                return (
                  <button
                    id={`command-option-${item.id}`}
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={flatIndex === activeIndex}
                    onClick={() => run(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      flatIndex === activeIndex
                        ? "bg-sage-soft text-forest"
                        : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {item.hint}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-ink-muted" />
                  </button>
                );
              })}
            </div>
          ))}
          {!filtered.length ? (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              No commands found.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
