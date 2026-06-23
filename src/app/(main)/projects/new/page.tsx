"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  FormField,
  Input,
  Textarea,
  Select,
  CheckboxChip,
} from "@/components/ui/field";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useTemplatesStore } from "@/lib/store/templates-store";
import { enumValues } from "@/lib/schemas";
import type {
  BrandVoice,
  OfferModel,
  OutputRequirement,
  SalesChannel,
  TravelStyle,
  TravelerType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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

const STARTER_OUTPUTS: {
  id: OutputRequirement;
  label: string;
}[] = [
  { id: "pdf", label: "PDF" },
  { id: "spreadsheet", label: "Spreadsheet" },
  { id: "food-guide", label: "Food guide" },
  { id: "packing-list", label: "Packing list" },
  { id: "booking-checklist", label: "Booking checklist" },
  { id: "portfolio-visuals", label: "Portfolio visuals" },
];

export default function NewProjectPage() {
  return (
    <React.Suspense
      fallback={<div className="h-64 rounded-2xl bg-paper/45" />}
    >
      <NewProjectForm />
    </React.Suspense>
  );
}

function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const create = useProjectsStore((s) => s.create);
  const createProjectFromTemplate = useProjectsStore(
    (s) => s.createProjectFromTemplate,
  );
  const templates = useTemplatesStore((s) => s.templates);
  const hydrateCloudTemplates = useTemplatesStore((s) => s.hydrateCloudTemplates);

  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [regions, setRegions] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [positioning, setPositioning] = React.useState("");
  const [styles, setStyles] = React.useState<TravelStyle[]>([]);
  const [travelers, setTravelers] = React.useState<TravelerType[]>([]);
  const [voice, setVoice] = React.useState<BrandVoice>("editorial");
  const [offerModel, setOfferModel] = React.useState<OfferModel>("digital");
  const [outputs, setOutputs] = React.useState<OutputRequirement[]>([
    "marketplace-listing",
    "pdf",
  ]);
  const [appliedTemplateId, setAppliedTemplateId] = React.useState<string | null>(
    null,
  );
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const templateId = searchParams.get("template");
  const selectedTemplate = templateId
    ? templates.find((template) => template.id === templateId)
    : undefined;

  React.useEffect(() => {
    void hydrateCloudTemplates();
  }, [hydrateCloudTemplates]);

  React.useEffect(() => {
    if (!selectedTemplate || appliedTemplateId === selectedTemplate.id) return;
    queueMicrotask(() => {
      setAppliedTemplateId(selectedTemplate.id);
      setName(`${selectedTemplate.name} project`);
      setCountry(selectedTemplate.project.country);
      setRegions(selectedTemplate.project.regions.join(", "));
      setAudience(selectedTemplate.project.targetAudience);
      setPositioning(selectedTemplate.project.positioning);
      setStyles(selectedTemplate.project.travelStyles);
      setTravelers(selectedTemplate.project.travelerTypes);
      setVoice(selectedTemplate.project.brandStyle.voice);
      setOfferModel(selectedTemplate.project.productionPlan.offerModel);
      setOutputs(selectedTemplate.project.productionPlan.outputs);
    });
  }, [appliedTemplateId, selectedTemplate]);

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
            channels:
              OFFER_OPTIONS.find((option) => option.id === offerModel)?.channels ??
              ["etsy"],
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
            channels:
              OFFER_OPTIONS.find((option) => option.id === offerModel)?.channels ??
              ["etsy"],
            outputs,
          });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not create the project.",
      );
    }
  }

  const canSubmit = name.trim() && country.trim();

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <SectionHeader
        eyebrow="New country project"
        title="Choose what you want to sell"
        subtitle="Start with the offer model and product promise. RouteCrafter will turn those choices into a guided route from brief to launch."
      />

      {selectedTemplate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sage/40 bg-sage-soft/40 px-4 py-3 text-sm text-forest">
          <span className="font-semibold">Started from “{selectedTemplate.name}”</span>
          <Link
            href="/projects/new"
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
                  "border px-5 py-5 text-left transition-colors",
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
            Create project
          </Button>
        </div>
      </form>
    </div>
  );
}
