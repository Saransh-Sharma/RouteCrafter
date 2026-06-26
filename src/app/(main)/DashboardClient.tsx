"use client";

import Link from "next/link";
import {
  Plus,
  Map,
  Images,
  Megaphone,
  FileType,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import * as React from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ImportProjectButton } from "@/components/dashboard/ImportProjectButton";
import { CountryProjectExplorer } from "@/components/dashboard/CountryProjectExplorer";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { useMounted } from "@/lib/hooks";
import { getProjectWorkflow } from "@/lib/workflow";
import type { AssetDTO } from "@/lib/persistence/types";
import { listAssets } from "@/lib/client/assets-api";

const quickActions = [
  {
    label: "Generate itinerary",
    description: "Matrix + day-by-day plans",
    icon: Map,
    tone: "from-sage/30 to-sage-soft text-forest",
  },
  {
    label: "Image prompts",
    description: "Five listing visuals",
    icon: Images,
    tone: "from-terracotta/25 to-terracotta-soft text-terracotta",
  },
  {
    label: "Listing copy",
    description: "Titles, tags, packages",
    icon: Megaphone,
    tone: "from-teal/25 to-teal-soft text-teal",
  },
  {
    label: "PDF builder",
    description: "Premium print-ready doc",
    icon: FileType,
    tone: "from-gold/30 to-gold-soft text-brown",
  },
];

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (hour < 21) return { text: "Good evening", emoji: "🌅" };
  return { text: "Good night", emoji: "🌙" };
}

const SUBTITLES = [
  "Ready to craft your next itinerary?",
  "What travel magic shall we create today?",
  "Let's build something wanderlust-worthy.",
  "Your itinerary studio awaits.",
];

function getDailySubtitle(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86400000,
  );
  return SUBTITLES[dayOfYear % SUBTITLES.length];
}

export default function DashboardPage() {
  const mounted = useMounted();
  const projects = useProjectsStore((s) => s.projects);
  const user = useAuthStore((s) => s.user);
  const visibleProjects = mounted ? projects : [];
  const continueProject = mounted
    ? [...projects]
        .filter((project) => project.status !== "Ready to sell")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0]
    : undefined;
  const [recentAssets, setRecentAssets] = React.useState<AssetDTO[]>([]);
  const greeting = getGreeting();

  React.useEffect(() => {
    if (!mounted || !user) return;
    let active = true;
    listAssets({ limit: 6 })
      .then((body) => {
        if (active) setRecentAssets(body.assets ?? []);
      })
      .catch(() => {
        if (active) setRecentAssets([]);
      });
    return () => {
      active = false;
    };
  }, [mounted, user]);

  return (
    <div className="space-y-12">
      {/* Personalized greeting */}
      <div
        className="animate-in fade-in slide-in-from-bottom-4 space-y-3 duration-700"
        style={{ animationFillMode: "both" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{greeting.emoji}</span>
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            {greeting.text}
            {user ? `, ${user.displayName}` : ""}
          </h1>
        </div>
        <p className="flex items-center gap-2 text-base text-ink-soft">
          <Sparkles className="size-4 text-gold" />
          {getDailySubtitle()}
        </p>
      </div>

      <SectionHeader
        eyebrow="Boutique Itinerary Studio"
        title="Your itinerary products"
        subtitle="Create country-specific, premium travel itinerary products and marketplace listing assets — built to sell on Fiverr, Etsy, Gumroad, and beyond."
        actions={
          <>
            <ImportProjectButton />
            <Link
              href="/projects/new"
              className="hidden h-9 items-center gap-2 rounded-full bg-forest px-4 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep sm:inline-flex"
            >
              <Plus className="size-4" />
              New project
            </Link>
          </>
        }
      />

      {continueProject ? (
        <Link
          href={`/projects/${continueProject.id}?stage=${
            getProjectWorkflow(continueProject).recommendedStage
          }`}
          className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft/60 p-5 transition-colors hover:border-forest/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              Continue where you left off
            </span>
            <span className="mt-1 block text-lg font-semibold text-ink">
              {continueProject.name}
            </span>
            <span className="text-sm text-ink-soft">
              {getProjectWorkflow(continueProject).recommendedAction}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
            Open project
            <ArrowRight className="size-4" />
          </span>
        </Link>
      ) : null}

      {/* Quick actions */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href="/projects/new"
                className="group rc-card flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <span
                  className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone}`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">
                    {action.label}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {action.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {recentAssets.length ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Recent assets</h2>
            <Link
              href="/library"
              className="flex items-center gap-1 text-sm font-medium text-forest hover:text-forest-deep"
            >
              Open library
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recentAssets.map((asset) => (
              <Link
                key={asset.id}
                href="/library"
                className="overflow-hidden rounded-[var(--radius-card)] border border-border-soft bg-paper/55"
              >
                {asset.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.blobUrl}
                    alt={asset.filename}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <span className="grid h-24 place-items-center bg-paper-2/50 text-terracotta">
                    <FileType className="size-7" />
                  </span>
                )}
                <span className="block truncate px-2 py-2 text-xs font-medium text-ink-soft">
                  {asset.filename}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Projects organized by country */}
      {visibleProjects.length > 0 ? (
        <CountryProjectExplorer projects={visibleProjects} />
      ) : mounted ? (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold text-ink">Country projects</h2>
          <Link
            href="/projects/new"
            className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-border-strong bg-paper/40 p-6 text-center transition-colors hover:border-forest/40 hover:bg-paper/70"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-forest transition-transform group-hover:scale-105">
              <Plus className="size-6" />
            </span>
            <span className="text-sm font-semibold text-ink">
              Create new country project
            </span>
            <span className="max-w-[14rem] text-xs text-ink-muted">
              Start a new Fiverr-ready itinerary product for any country.
            </span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
