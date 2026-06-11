"use client";

import Link from "next/link";
import {
  Plus,
  Map,
  Images,
  Megaphone,
  FileType,
  ArrowRight,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PreviewCard } from "@/components/ui/PreviewCard";
import { ImportProjectButton } from "@/components/dashboard/ImportProjectButton";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useMounted } from "@/lib/hooks";

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

export default function DashboardPage() {
  const mounted = useMounted();
  const projects = useProjectsStore((s) => s.projects);
  const recent = mounted ? projects.slice(0, 5) : [];

  return (
    <div className="space-y-12">
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

      {/* Projects */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Country projects</h2>
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm font-medium text-forest hover:text-forest-deep"
          >
            View all
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/projects/new"
            className="group flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-border-strong bg-paper/40 p-6 text-center transition-colors hover:border-forest/40 hover:bg-paper/70"
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

          {recent.map((project) => (
            <PreviewCard key={project.id} project={project} />
          ))}
        </div>
      </section>
    </div>
  );
}
