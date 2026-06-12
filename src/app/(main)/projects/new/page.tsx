"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { enumValues } from "@/lib/schemas";
import type { BrandVoice, TravelStyle, TravelerType } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const create = useProjectsStore((s) => s.create);
  const update = useProjectsStore((s) => s.update);

  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [regions, setRegions] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [positioning, setPositioning] = React.useState("");
  const [styles, setStyles] = React.useState<TravelStyle[]>([]);
  const [travelers, setTravelers] = React.useState<TravelerType[]>([]);
  const [voice, setVoice] = React.useState<BrandVoice>("editorial");
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
      const project = create({
        name: name.trim(),
        country: country.trim(),
        regions: regions
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
        positioning: positioning.trim(),
        targetAudience: audience.trim(),
        travelStyles: styles,
        travelerTypes: travelers,
      });
      if (voice !== "editorial") {
        const result = update(project.id, {
          brandStyle: { ...project.brandStyle, voice },
        });
        if (!result.ok) throw new Error(result.error);
      }
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
        title="Create an itinerary product"
        subtitle="Set the foundations for a country listing. You'll configure deep trip parameters, generate prompts, and build deliverables inside the workspace."
      />

      <form onSubmit={handleSubmit} className="space-y-8">
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
