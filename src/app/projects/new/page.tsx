"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  FormField,
  Input,
  Textarea,
  Select,
  CheckboxChip,
} from "@/components/ui/field";
import type { TravelStyle, TravelerType } from "@/lib/types";

const TRAVEL_STYLES: TravelStyle[] = [
  "Classic first-timer",
  "Local-first slow travel",
  "Food/culture heavy",
  "Nature/adventure",
  "Romantic",
  "Family-friendly",
  "Premium comfort",
  "Budget-friendly",
  "Wellness",
  "Photography",
  "Shopping",
  "Nightlife",
  "Spiritual/cultural",
];

const TRAVELER_TYPES: TravelerType[] = [
  "Solo",
  "Couple",
  "Family",
  "Group",
  "Senior travelers",
  "Luxury travelers",
  "Budget travelers",
  "Business + leisure",
];

export default function NewProjectPage() {
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [regions, setRegions] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [positioning, setPositioning] = React.useState("");
  const [styles, setStyles] = React.useState<TravelStyle[]>([]);
  const [travelers, setTravelers] = React.useState<TravelerType[]>([]);
  const [submitted, setSubmitted] = React.useState(false);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const canSubmit = name.trim() && country.trim();

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="space-y-5 p-8 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-forest">
              <Check className="size-7" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold text-ink">
                Project configured
              </h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                {name || "Your project"} for {country || "your country"} is ready
                to open. Saving to local storage and seeding the workspace lands
                in Phase 2 — for now, preview the studio with a sample project.
              </p>
            </div>

            <div className="rc-divider" />

            <div className="space-y-3 text-left">
              <Detail label="Name" value={name || "—"} />
              <Detail label="Country" value={country || "—"} />
              <Detail label="Cities / regions" value={regions || "—"} />
              <Detail label="Target audience" value={audience || "—"} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Travel styles
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {styles.length ? (
                    styles.map((s) => (
                      <Badge key={s} tone="sage">
                        {s}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-ink-soft">—</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
              <Link
                href="/projects/japan-family-7"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-paper transition-colors hover:bg-forest-deep"
              >
                <Sparkles className="size-4" />
                Open sample workspace
              </Link>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Edit configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                {TRAVEL_STYLES.map((style) => (
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
                {TRAVELER_TYPES.map((t) => (
                  <CheckboxChip
                    key={t}
                    label={t}
                    selected={travelers.includes(t)}
                    onToggle={() => setTravelers((s) => toggle(s, t))}
                  />
                ))}
              </div>
            </FormField>

            <FormField label="Brand voice" htmlFor="voice" hint="Used to tune generated copy later.">
              <Select id="voice" defaultValue="editorial">
                <option value="editorial">Editorial &amp; warm</option>
                <option value="premium">Premium &amp; understated</option>
                <option value="friendly">Friendly &amp; practical</option>
                <option value="adventurous">Adventurous &amp; energetic</option>
              </Select>
            </FormField>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}
