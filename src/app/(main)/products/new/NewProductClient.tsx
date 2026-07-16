"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LibraryBig,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, useToast } from "@/components/ui";
import {
  FormField,
  Input,
  Textarea,
  Select,
  CheckboxChip,
} from "@/components/ui/field";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useTemplatesStore } from "@/lib/store/templates-store";
import { seedTemplates } from "@/lib/templates";
import { enumValues } from "@/lib/schemas";
import type {
  BrandVoice,
  OfferModel,
  OutputRequirement,
  SalesChannel,
  Template,
  TemplateCategory,
  TravelStyle,
  TravelerType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { SeriesBatchForm } from "@/components/series/SeriesBatchForm";

type CreateMode = "blank" | "template" | "series";

const OFFER_OPTIONS: {
  id: OfferModel;
  label: string;
  description: string;
  channels: SalesChannel[];
}[] = [
  {
    id: "digital",
    label: "Digital download",
    description: "A prebuilt itinerary sold on Etsy, Gumroad, or your shop.",
    channels: ["etsy"],
  },
  {
    id: "service",
    label: "Custom service",
    description: "A personalized itinerary created from a buyer brief.",
    channels: ["fiverr"],
  },
  {
    id: "hybrid",
    label: "Hybrid",
    description: "A ready-made product with an optional customization service.",
    channels: ["etsy", "direct"],
  },
];

const STARTER_OUTPUTS: { id: OutputRequirement; label: string }[] = [
  { id: "pdf", label: "PDF" },
  { id: "spreadsheet", label: "Spreadsheet" },
  { id: "food-guide", label: "Food guide" },
  { id: "packing-list", label: "Packing list" },
  { id: "booking-checklist", label: "Booking checklist" },
  { id: "portfolio-visuals", label: "Portfolio visuals" },
];

const TEMPLATE_FILTERS: Array<{ id: TemplateCategory | "all"; label: string }> =
  [
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

export default function NewProductPage() {
  return (
    <React.Suspense fallback={<div className="h-64 rounded-2xl bg-paper/45" />}>
      <NewProductFlow />
    </React.Suspense>
  );
}

function NewProductFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templates = useTemplatesStore((s) => s.templates);
  const hydrateCloudTemplates = useTemplatesStore(
    (s) => s.hydrateCloudTemplates,
  );

  React.useEffect(() => {
    void hydrateCloudTemplates();
  }, [hydrateCloudTemplates]);

  const templateId = searchParams.get("template");
  const selectedTemplate = templateId
    ? templates.find((template) => template.id === templateId)
    : undefined;
  const requestedMode = searchParams.get("mode");
  const mode: CreateMode =
    requestedMode === "series"
      ? "series"
      : requestedMode === "template" || selectedTemplate
        ? "template"
        : "blank";

  function setMode(next: CreateMode) {
    const params = new URLSearchParams();
    params.set("mode", next);
    router.replace(`/products/new?${params.toString()}`);
  }

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Products
      </Link>

      <div>
        <p className="rc-eyebrow">New product</p>
        <h1 className="mt-2 font-display text-display text-ink">
          Choose what you want to sell
        </h1>
        <p className="mt-2 max-w-xl text-body text-ink-soft">
          Start blank, from a template, or generate a whole multi-country
          series from one spec.
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Creation mode">
        {(
          [
            ["blank", "Start blank"],
            ["template", "From template"],
            ["series", "Series (multi-country)"],
          ] as [CreateMode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              mode === id
                ? "border-forest bg-sage-soft text-forest"
                : "border-border-strong bg-paper/60 text-ink-soft hover:border-forest/40 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "series" ? (
        <SeriesBatchForm />
      ) : mode === "template" && !selectedTemplate ? (
        <TemplateGallery
          onUse={(template) =>
            router.replace(`/products/new?mode=template&template=${template.id}`)
          }
        />
      ) : (
        <NewProductForm
          key={selectedTemplate?.id ?? "blank"}
          selectedTemplate={selectedTemplate}
        />
      )}
    </div>
  );
}

function TemplateGallery({ onUse }: { onUse: (template: Template) => void }) {
  const templates = useTemplatesStore((state) => state.templates);
  const removeTemplate = useTemplatesStore((state) => state.removeTemplate);
  const { toast } = useToast();
  const [filter, setFilter] = React.useState<TemplateCategory | "all">("all");

  const visible =
    filter === "all"
      ? templates
      : templates.filter((template) => template.category === filter);
  const myTemplates = templates.filter(
    (template) => template.category === "my-template",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_FILTERS.map((item) => (
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
          description="Save any product as a template from the editor actions menu to reuse its configuration, brand voice, routes, and document style."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              removable={!seedTemplates.some((seed) => seed.id === template.id)}
              onUse={() => onUse(template)}
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
  onUse,
  onRemove,
}: {
  template: Template;
  removable: boolean;
  onUse: () => void;
  onRemove: () => void;
}) {
  const editionChips = [
    ...new Set(
      template.project.productionPlan.editions.map(
        (edition) => edition.duration,
      ),
    ),
  ].slice(0, 2);
  const travelerChips = [
    ...new Set(
      template.project.productionPlan.editions.map(
        (edition) => edition.travelerType,
      ),
    ),
  ].slice(0, 2);

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
          {editionChips.map((duration) => (
            <Badge key={duration}>{duration}</Badge>
          ))}
          {travelerChips.map((traveler) => (
            <Badge key={traveler} tone="gold">
              {traveler}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-forest px-4 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            Use template
            <ArrowRight className="size-4" />
          </button>
          {removable ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${template.name}`}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-terracotta/10 hover:text-terracotta"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function NewProductForm({
  selectedTemplate,
}: {
  selectedTemplate: Template | undefined;
}) {
  const router = useRouter();
  const create = useProjectsStore((s) => s.create);
  const createProjectFromTemplate = useProjectsStore(
    (s) => s.createProjectFromTemplate,
  );

  const templateConfig = selectedTemplate?.project.tripConfigs[0];
  const [name, setName] = React.useState(
    selectedTemplate ? `${selectedTemplate.name} product` : "",
  );
  const [country, setCountry] = React.useState(
    selectedTemplate?.project.country ?? "",
  );
  const [regions, setRegions] = React.useState(
    selectedTemplate?.project.regions.join(", ") ?? "",
  );
  const [audience, setAudience] = React.useState(
    selectedTemplate?.project.targetAudience ?? "",
  );
  const [positioning, setPositioning] = React.useState(
    selectedTemplate?.project.positioning ?? "",
  );
  const [styles, setStyles] = React.useState<TravelStyle[]>(
    templateConfig?.travelStyles ?? [],
  );
  const [travelers, setTravelers] = React.useState<TravelerType[]>(
    templateConfig ? [templateConfig.travelerType] : [],
  );
  const [voice, setVoice] = React.useState<BrandVoice>(
    selectedTemplate?.project.brandStyle.voice ?? "editorial",
  );
  const [offerModel, setOfferModel] = React.useState<OfferModel>(
    selectedTemplate?.project.productionPlan.offerModel ?? "digital",
  );
  const [outputs, setOutputs] = React.useState<OutputRequirement[]>(
    selectedTemplate?.project.productionPlan.outputs ?? [
      "marketplace-listing",
      "pdf",
    ],
  );
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      const regionsList = regions
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      const channels =
        OFFER_OPTIONS.find((option) => option.id === offerModel)?.channels ??
        ["etsy"];
      const project = selectedTemplate
        ? createProjectFromTemplate(selectedTemplate, {
            name: name.trim(),
            country: country.trim(),
            regions: regionsList,
            positioning: positioning.trim(),
            targetAudience: audience.trim(),
            travelStyles: styles,
            travelerTypes: travelers,
            voice,
            offerModel,
            channels,
            outputs,
          })
        : create({
            name: name.trim(),
            country: country.trim(),
            regions: regionsList,
            positioning: positioning.trim(),
            targetAudience: audience.trim(),
            travelStyles: styles,
            travelerTypes: travelers,
            brandStyle: { voice },
            offerModel,
            channels,
            outputs,
          });
      router.push(`/products/${project.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not create the product.",
      );
    }
  }

  const canSubmit = name.trim() && country.trim();

  return (
    <div className="space-y-8">
      {selectedTemplate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-sage/40 bg-sage-soft/40 px-4 py-3 text-sm text-forest">
          <span className="font-semibold">
            Started from “{selectedTemplate.name}”
          </span>
          <Link
            href="/products/new?mode=template"
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold hover:bg-paper/70"
          >
            <X className="size-3.5" />
            Clear
          </Link>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {OFFER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setOfferModel(option.id)}
                className={cn(
                  "rounded-[var(--radius-card)] border px-5 py-5 text-left transition-colors",
                  offerModel === option.id
                    ? "border-forest bg-sage-soft/70"
                    : "border-border-soft bg-paper/45 hover:border-forest/35",
                )}
              >
                <span className="text-base font-semibold text-ink">
                  {option.label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-ink-soft">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField label="Project name" htmlFor="name" required>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Japan Travel Itinerary Product"
                />
              </FormField>
              <FormField label="Country" htmlFor="country" required>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Japan"
                />
              </FormField>
            </div>

            <FormField
              label="Cities / regions"
              htmlFor="regions"
              hint="Comma-separated. You can refine these later in trip configuration."
            >
              <Input
                id="regions"
                value={regions}
                onChange={(e) => setRegions(e.target.value)}
                placeholder="e.g. Tokyo, Hakone, Kyoto, Osaka"
              />
            </FormField>

            <FormField label="Target audience" htmlFor="audience">
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. First-time families visiting Japan"
              />
            </FormField>

            <FormField
              label="Positioning"
              htmlFor="positioning"
              hint="One line that captures how this product is different."
            >
              <Textarea
                id="positioning"
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                placeholder="e.g. Human-paced, family-friendly Japan with food, culture, and built-in rest days."
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <FormField
              label="Travel styles"
              hint="Pick the angles this product leans into."
            >
              <div className="flex flex-wrap gap-2">
                {enumValues.travelStyle.map((style) => (
                  <CheckboxChip
                    key={style}
                    label={style}
                    selected={styles.includes(style)}
                    onToggle={() => setStyles((s) => toggle(s, style))}
                  />
                ))}
              </div>
            </FormField>

            <FormField
              label="Traveler types supported"
              hint="Who can this product be tailored for?"
            >
              <div className="flex flex-wrap gap-2">
                {enumValues.travelerType.map((t) => (
                  <CheckboxChip
                    key={t}
                    label={t}
                    selected={travelers.includes(t)}
                    onToggle={() => setTravelers((s) => toggle(s, t))}
                  />
                ))}
              </div>
            </FormField>

            <FormField
              label="Brand voice"
              htmlFor="voice"
              hint="Used to tune generated copy later."
            >
              <Select
                id="voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value as BrandVoice)}
              >
                <option value="editorial">Editorial &amp; warm</option>
                <option value="premium">Premium &amp; understated</option>
                <option value="friendly">Friendly &amp; practical</option>
                <option value="adventurous">Adventurous &amp; energetic</option>
              </Select>
            </FormField>

            <FormField
              label="Starter output package"
              hint="Marketplace listing is always included. Add only the files and assets you intend to finish."
            >
              <div className="flex flex-wrap gap-2">
                {STARTER_OUTPUTS.map((output) => (
                  <CheckboxChip
                    key={output.id}
                    label={output.label}
                    selected={outputs.includes(output.id)}
                    onToggle={() =>
                      setOutputs((current) =>
                        current.includes(output.id)
                          ? current.filter((item) => item !== output.id)
                          : [...current, output.id],
                      )
                    }
                  />
                ))}
              </div>
            </FormField>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {submitError ? (
            <p className="mr-auto text-sm text-terracotta">{submitError}</p>
          ) : null}
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={!canSubmit}>
            Create product
          </Button>
        </div>
      </form>
    </div>
  );
}
