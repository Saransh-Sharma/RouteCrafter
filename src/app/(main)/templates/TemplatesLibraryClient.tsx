"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LibraryBig, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useToast } from "@/components/ui";
import { useTemplatesStore } from "@/lib/store/templates-store";
import { seedTemplates } from "@/lib/templates";
import type { Template, TemplateCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ id: TemplateCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "traveler-preset", label: "Traveler presets" },
  { id: "country-starter", label: "Country starters" },
  { id: "my-template", label: "My templates" },
];

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  "traveler-preset": "Traveler preset",
  "country-starter": "Country starter",
  "my-template": "My template",
};

export default function TemplatesPage() {
  const templates = useTemplatesStore((state) => state.templates);
  const hydrateCloudTemplates = useTemplatesStore(
    (state) => state.hydrateCloudTemplates,
  );
  const removeTemplate = useTemplatesStore((state) => state.removeTemplate);
  const { toast } = useToast();
  const [filter, setFilter] = React.useState<TemplateCategory | "all">("all");

  React.useEffect(() => {
    void hydrateCloudTemplates();
  }, [hydrateCloudTemplates]);

  const visible =
    filter === "all"
      ? templates
      : templates.filter((template) => template.category === filter);
  const myTemplates = templates.filter(
    (template) => template.category === "my-template",
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Template Library"
        title="Start closer to a sellable itinerary"
        subtitle="Reusable house styles, traveler presets, and country starters for building catalog variations without starting from a blank brief."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
              filter === item.id
                ? "border-forest bg-sage-soft text-forest"
                : "border-border-strong bg-paper/60 text-ink-soft hover:border-forest/40 hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filter === "my-template" && myTemplates.length === 0 ? (
        <EmptyState
          icon={LibraryBig}
          title="No saved templates yet"
          description="Save any project as a template from the workspace actions menu to reuse its configuration, brand voice, routes, and document style."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              removable={!seedTemplates.some((seed) => seed.id === template.id)}
              onRemove={() => {
                void removeTemplate(template.id).catch((error) => {
                  toast(
                    error instanceof Error
                      ? error.message
                      : "Could not remove the template.",
                    "error",
                  );
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  removable,
  onRemove,
}: {
  template: Template;
  removable: boolean;
  onRemove: () => void;
}) {
  return (
    <article className="group rc-card flex min-h-72 flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative h-28 bg-gradient-to-br from-sage/30 via-paper-2 to-terracotta-soft px-5 pt-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-forest-deep/80">
          <Sparkles className="size-3.5" />
          {CATEGORY_LABEL[template.category]}
        </div>
        <div className="absolute -bottom-3 right-5 flex gap-1.5">
          <div className="h-16 w-12 rotate-3 rounded-md border border-border-soft bg-paper shadow-[var(--shadow-soft)]" />
          <div className="h-16 w-12 -rotate-2 rounded-md border border-border-soft bg-paper shadow-[var(--shadow-soft)]" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="text-lg font-semibold leading-snug text-ink">
            {template.name}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-soft">
            {template.description || template.project.positioning}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {template.project.country ? (
            <Badge tone="sage">{template.project.country}</Badge>
          ) : null}
          {template.project.durations.slice(0, 2).map((duration) => (
            <Badge key={duration}>{duration}</Badge>
          ))}
          {template.project.travelerTypes.slice(0, 2).map((traveler) => (
            <Badge key={traveler} tone="gold">
              {traveler}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Link
            href={`/projects/new?template=${template.id}`}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-forest px-4 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            Use template
            <ArrowRight className="size-4" />
          </Link>
          {removable ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Delete ${template.name}`}
              className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-terracotta/10 hover:text-terracotta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
