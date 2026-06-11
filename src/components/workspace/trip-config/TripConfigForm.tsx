"use client";

import * as React from "react";
import { useForm, Controller, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import {
  tripConfigurationSchema,
  createEmptyTripConfig,
  enumValues,
  type TripConfiguration,
} from "@/lib/schemas";
import type { Project } from "@/lib/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { FormField, Input, Select } from "@/components/ui/field";
import { Section } from "./Section";
import { ChipGroup } from "./ChipGroup";
import { TagInput } from "./TagInput";
import { ConfigSummary } from "./ConfigSummary";

type SaveStatus = "idle" | "saving" | "saved";

/** Serialize form values for change detection, ignoring id/updatedAt. */
function serializeConfig(v: TripConfiguration): string {
  return JSON.stringify({ ...v, id: undefined, updatedAt: undefined });
}

export function TripConfigForm({ project }: { project: Project }) {
  const update = useProjectsStore((s) => s.update);
  const [status, setStatus] = React.useState<SaveStatus>("idle");

  const defaults = React.useMemo<TripConfiguration>(
    () =>
      project.tripConfigs[0] ??
      createEmptyTripConfig({ cities: project.regions }),
    [project.tripConfigs, project.regions],
  );

  const { register, control, reset } = useForm<TripConfiguration>({
    resolver: zodResolver(tripConfigurationSchema) as Resolver<TripConfiguration>,
    defaultValues: defaults,
  });

  // Tracks the last persisted snapshot to break the save -> reset -> save loop.
  const lastSavedRef = React.useRef<string>(serializeConfig(defaults));
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    reset(defaults);
    lastSavedRef.current = serializeConfig(defaults);
  }, [defaults, reset]);

  const values = useWatch({ control }) as TripConfiguration;

  // Debounced auto-save: persist whenever the form differs from what's stored.
  React.useEffect(() => {
    if (!values) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const snapshot = serializeConfig(values);
    if (snapshot === lastSavedRef.current) return;

    setStatus("saving");
    const timer = window.setTimeout(() => {
      const config: TripConfiguration = {
        ...values,
        id: defaults.id,
        updatedAt: new Date().toISOString(),
      };
      update(project.id, { tripConfigs: [config] });
      lastSavedRef.current = snapshot;
      setStatus("saved");
    }, 600);

    return () => window.clearTimeout(timer);
  }, [values, defaults.id, project.id, update]);

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        <Section title="Basics" description="Cities, duration, and the core trip shape.">
          <FormField label="Cities / regions to include">
            <Controller
              control={control}
              name="cities"
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Type a city and press Enter"
                />
              )}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField label="Trip duration" htmlFor="duration">
              <Select id="duration" {...register("duration")}>
                {enumValues.duration.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Custom days (optional)"
              htmlFor="customDays"
              hint="Overrides the duration label when set."
            >
              <Input
                id="customDays"
                type="number"
                min={1}
                {...register("customDays", { valueAsNumber: true })}
              />
            </FormField>
          </div>
        </Section>

        <Section
          title="Travelers & style"
          description="Who it's for and the angles it leans into."
        >
          <FormField label="Traveler type" htmlFor="travelerType">
            <Select id="travelerType" {...register("travelerType")}>
              {enumValues.travelerType.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Travel styles">
            <Controller
              control={control}
              name="travelStyles"
              render={({ field }) => (
                <ChipGroup
                  options={enumValues.travelStyle}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
        </Section>

        <Section title="Pace & budget">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField label="Pace" htmlFor="pace">
              <Select id="pace" {...register("pace")}>
                {enumValues.pace.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Budget level" htmlFor="budget">
              <Select id="budget" {...register("budget")}>
                {enumValues.budget.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Section>

        <Section
          title="Preferences"
          description="Accommodation, food, and transport leanings."
        >
          <FormField label="Accommodation preference">
            <Controller
              control={control}
              name="accommodation"
              render={({ field }) => (
                <ChipGroup
                  options={enumValues.accommodation}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Food preference">
            <Controller
              control={control}
              name="food"
              render={({ field }) => (
                <ChipGroup
                  options={enumValues.foodPref}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Transport preference">
            <Controller
              control={control}
              name="transport"
              render={({ field }) => (
                <ChipGroup
                  options={enumValues.transportPref}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
        </Section>

        <Section title="Interests & constraints">
          <FormField label="Interests">
            <Controller
              control={control}
              name="interests"
              render={({ field }) => (
                <ChipGroup
                  options={enumValues.interest}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Constraints">
            <Controller
              control={control}
              name="constraints"
              render={({ field }) => (
                <ChipGroup
                  options={enumValues.constraint}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
        </Section>

        <Section
          title="Logistics"
          description="Season and arrival/departure details."
        >
          <FormField label="Season / month" htmlFor="seasonMonth">
            <Input
              id="seasonMonth"
              placeholder="e.g. Late March (cherry blossom season)"
              {...register("seasonMonth")}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField label="Arrival city" htmlFor="arrivalCity">
              <Input id="arrivalCity" {...register("arrivalCity")} />
            </FormField>
            <FormField label="Departure city" htmlFor="departureCity">
              <Input id="departureCity" {...register("departureCity")} />
            </FormField>
            <FormField label="Arrival time" htmlFor="arrivalTime">
              <Input
                id="arrivalTime"
                placeholder="e.g. Morning"
                {...register("arrivalTime")}
              />
            </FormField>
            <FormField label="Departure time" htmlFor="departureTime">
              <Input
                id="departureTime"
                placeholder="e.g. Late evening"
                {...register("departureTime")}
              />
            </FormField>
          </div>
        </Section>

        <Section title="Must-see & avoid">
          <FormField label="Must-see places">
            <Controller
              control={control}
              name="mustSee"
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Add a place and press Enter"
                />
              )}
            />
          </FormField>
          <FormField label="Places / things to avoid">
            <Controller
              control={control}
              name="avoid"
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Add something to avoid and press Enter"
                />
              )}
            />
          </FormField>
          <FormField label="Special occasion" htmlFor="specialOccasion">
            <Input
              id="specialOccasion"
              placeholder="e.g. Honeymoon, milestone birthday"
              {...register("specialOccasion")}
            />
          </FormField>
        </Section>

        <Section
          title="Deliverables"
          description="What this configuration should produce."
        >
          <Controller
            control={control}
            name="deliverables"
            render={({ field }) => (
              <ChipGroup
                options={enumValues.deliverable}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Section>

        <div className="flex items-center justify-end gap-2 text-sm">
          {status === "saving" ? (
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </span>
          ) : status === "saved" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-forest">
              <Check className="size-4" />
              All changes saved
            </span>
          ) : (
            <span className="text-ink-muted">Changes save automatically</span>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        <ConfigSummary values={values} project={project} />
      </div>
    </form>
  );
}
