"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Layers, Plus, Search } from "lucide-react";
import type { Project } from "@/lib/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { useMounted } from "@/lib/hooks";
import { getProjectWorkflow } from "@/lib/workflow";
import { ImportProjectButton } from "@/components/dashboard/ImportProjectButton";
import { ProductCard } from "@/components/shelf/ProductCard";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

type Grouping = "all" | "country" | "series";

const GREETINGS: [number, string][] = [
  [12, "Good morning"],
  [17, "Good afternoon"],
  [21, "Good evening"],
  [24, "Good night"],
];

/**
 * The Shelf — home is the product list. Image-forward grid, groupable by
 * country or series, with the whole studio one click away.
 */
export default function ShelfClient() {
  const mounted = useMounted();
  const projects = useProjectsStore((s) => s.projects);
  const user = useAuthStore((s) => s.user);
  const [grouping, setGrouping] = React.useState<Grouping>("all");
  const [query, setQuery] = React.useState("");

  const visible = mounted ? projects : [];
  const filtered = query.trim()
    ? visible.filter((project) =>
        `${project.name} ${project.country} ${project.positioning}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : visible;

  const continueProject = mounted
    ? [...projects]
        .filter((project) => project.status !== "Ready to sell")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0]
    : undefined;

  const greeting =
    GREETINGS.find(([hour]) => new Date().getHours() < hour)?.[1] ??
    "Good night";

  return (
    <div className="space-y-9">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rc-eyebrow">
            {greeting}
            {user ? `, ${user.displayName}` : ""}
          </p>
          <h1 className="mt-2 font-display text-display text-ink">Products</h1>
          <p className="mt-2 max-w-xl text-body text-ink-soft">
            Premium travel itinerary products and listing assets — built to
            sell on Fiverr, Etsy, Gumroad, and beyond.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ImportProjectButton />
          <Link
            href="/products/new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep"
          >
            <Plus className="size-4" />
            New product
          </Link>
        </div>
      </div>

      {continueProject ? (
        <Link
          href={`/products/${continueProject.id}`}
          className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft/60 p-5 transition-colors hover:border-forest/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              Continue where you left off
            </span>
            <span className="mt-1 block text-heading font-display text-ink">
              {continueProject.name}
            </span>
            <span className="text-caption text-ink-soft">
              {getProjectWorkflow(continueProject).recommendedAction}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
            Open product
            <ArrowRight className="size-4" />
          </span>
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-4">
        <div className="flex gap-1" role="tablist" aria-label="Group products">
          {(
            [
              ["all", "All"],
              ["country", "By country"],
              ["series", "By series"],
            ] as [Grouping, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={grouping === id}
              onClick={() => setGrouping(id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-caption font-semibold transition-colors",
                grouping === id
                  ? "bg-sage-soft text-forest"
                  : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-full border border-border-soft bg-paper px-3.5 py-1.5">
          <Search className="size-3.5 text-ink-muted" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="w-40 bg-transparent text-caption text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={Layers}
          title={query ? "No products match" : "No products yet"}
          description={
            query
              ? "Try a different search."
              : "Create your first itinerary product to get started."
          }
          action={
            query ? undefined : (
              <Link
                href="/products/new"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-paper hover:bg-forest-deep"
              >
                <Plus className="size-4" />
                New product
              </Link>
            )
          }
        />
      ) : grouping === "all" ? (
        <ProductGrid projects={sortByUpdated(filtered)} />
      ) : (
        groupProjects(filtered, grouping).map(([label, group]) => (
          <section key={label} className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="rc-section-title">{label}</h2>
              <span className="text-caption text-ink-muted">
                {group.length} product{group.length === 1 ? "" : "s"}
              </span>
            </div>
            <ProductGrid projects={sortByUpdated(group)} />
          </section>
        ))
      )}
    </div>
  );
}

function sortByUpdated(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function groupProjects(
  projects: Project[],
  grouping: "country" | "series",
): [string, Project[]][] {
  const groups = new Map<string, Project[]>();
  for (const project of projects) {
    const key =
      grouping === "country"
        ? project.country || "No country"
        : project.series
          ? project.series.seriesName || "Untitled series"
          : "Standalone products";
    groups.set(key, [...(groups.get(key) ?? []), project]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function ProductGrid({ projects }: { projects: Project[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProductCard key={project.id} project={project} />
      ))}
    </div>
  );
}
