"use client";

import * as React from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEmptyTripConfig,
  enumValues,
  tripConfigurationSchema,
  type TripConfiguration,
} from "@/lib/schemas";
import type { Project } from "@/lib/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { FormField, Input, Select } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { AiRunSheet } from "@/components/ai/AiRunSheet";
import { appendAiRun, createAiRunMetadata } from "@/lib/ai/metadata";
import { markAiRunApplied } from "@/lib/assets/capture";
import { buildBriefExtractionPrompt, tripConfigCurrentValue } from "@/lib/ai/tasks";
import { parseJsonObject } from "@/lib/ai/parse";
import { Section } from "./Section";
import { ChipGroup } from "./ChipGroup";
import { ConfigSummary } from "./ConfigSummary";
import { TagInput } from "./TagInput";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function serializeConfig(value: TripConfiguration): string {
  return JSON.stringify({ ...value, id: undefined, updatedAt: undefined });
}

export function TripConfigForm({
  project,
  showDeliverables = true,
}: {
  project: Project;
  showDeliverables?: boolean;
}) {
  const update = useProjectsStore((state) => state.update);
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [brief, setBrief] = React.useState("");
  const [briefAiOpen, setBriefAiOpen] = React.useState(false);

  const defaults = React.useMemo<TripConfiguration>(
    () =>
      project.tripConfigs[0] ??
      createEmptyTripConfig({ cities: project.regions }),
    [project.tripConfigs, project.regions],
  );

  const { register, control, reset } = useForm<TripConfiguration>({
    resolver: zodResolver(
      tripConfigurationSchema,
    ) as Resolver<TripConfiguration>,
    defaultValues: defaults,
  });

  const values = useWatch({ control }) as TripConfiguration;
  const lastSavedRef = React.useRef(serializeConfig(defaults));
  const latestValuesRef = React.useRef(values);
  const timerRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("routecrafter:save-state", {
        detail: { status, error: saveError },
      }),
    );
  }, [saveError, status]);

  React.useEffect(() => {
    reset(defaults);
    lastSavedRef.current = serializeConfig(defaults);
  }, [defaults, reset]);

  React.useEffect(() => {
    latestValuesRef.current = values;
  }, [values]);

  const persistValues = React.useCallback(
    (raw: TripConfiguration, reportStatus: boolean) => {
      const result = tripConfigurationSchema.safeParse({
        ...raw,
        id: defaults.id,
        updatedAt: new Date().toISOString(),
      });

      if (!result.success) {
        if (reportStatus) {
          setStatus("error");
          setSaveError(result.error.issues[0]?.message ?? "Invalid configuration.");
        }
        return;
      }

      const snapshot = serializeConfig(result.data);
      if (snapshot === lastSavedRef.current) {
        if (reportStatus) {
          setStatus("saved");
          setSaveError(null);
        }
        return;
      }

      const mutation = update(project.id, { tripConfigs: [result.data] });
      if (!mutation.ok) {
        if (reportStatus) {
          setStatus("error");
          setSaveError(mutation.error);
        }
        return;
      }

      lastSavedRef.current = snapshot;
      if (reportStatus) {
        setStatus("saved");
        setSaveError(null);
      }
    },
    [defaults.id, project.id, update],
  );

  function validateBriefOutput(text: string): string | null {
    try {
      const parsed = tripConfigurationSchema.safeParse(parseJsonObject(text));
      return parsed.success
        ? null
        : parsed.error.issues[0]?.message ??
            "The model returned trip configuration JSON RouteCrafter could not apply.";
    } catch {
      return "The model returned content RouteCrafter could not parse as JSON.";
    }
  }

  function mergeConfig(
    current: TripConfiguration,
    incoming: TripConfiguration,
    mode: "replace" | "fill-empty" | "append",
  ): TripConfiguration {
    if (mode === "replace") return incoming;
    const merged = { ...current };
    for (const key of Object.keys(incoming) as (keyof TripConfiguration)[]) {
      const currentValue = current[key];
      const incomingValue = incoming[key];
      const empty =
        currentValue === "" ||
        currentValue === undefined ||
        (Array.isArray(currentValue) && currentValue.length === 0);
      if (empty && incomingValue !== undefined) {
        (merged as Record<string, unknown>)[key] = incomingValue;
      }
    }
    return merged;
  }

  function applyBriefConfig(
    text: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
    mode: "replace" | "fill-empty" | "append",
  ) {
    const parsed = tripConfigurationSchema.parse(parseJsonObject(text));
    const next = mergeConfig(values, parsed, mode);
    reset(next);
    persistValues(next, true);
    update(project.id, {
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: "brief",
          label: "Extracted trip configuration from brief",
          source: "trip-config",
        }),
      ),
    });
    void markAiRunApplied({ aiRunId: result.aiRunId, projectId: project.id });
  }

  React.useEffect(() => {
    if (!values) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setStatus("saving");
    setSaveError(null);
    timerRef.current = window.setTimeout(() => {
      persistValues(values, true);
      timerRef.current = null;
    }, 600);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [persistValues, values]);

  React.useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (latestValuesRef.current) {
        persistValues(latestValuesRef.current, false);
      }
    },
    [persistValues],
  );

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
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
                {enumValues.duration.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Custom days (optional)"
              htmlFor="customDays"
              hint="Overrides the duration label. Maximum 60 days."
            >
              <Input
                id="customDays"
                type="number"
                min={1}
                max={60}
                {...register("customDays", {
                  setValueAs: (value) =>
                    value === "" ? undefined : Number(value),
                })}
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
              {enumValues.travelerType.map((traveler) => (
                <option key={traveler} value={traveler}>
                  {traveler}
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
                {enumValues.pace.map((pace) => (
                  <option key={pace} value={pace}>
                    {pace}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Budget level" htmlFor="budget">
              <Select id="budget" {...register("budget")}>
                {enumValues.budget.map((budget) => (
                  <option key={budget} value={budget}>
                    {budget}
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

        {showDeliverables ? (
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
        ) : null}

      </div>

      <div className="space-y-6 lg:col-span-1">
        <Section
          title="AI fill from brief"
          description="Paste a buyer message, then preview extracted trip fields before applying."
        >
          <FormField label="Buyer/client brief">
            <textarea
              value={brief}
              rows={7}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Paste the buyer's message, destination notes, dates, preferences, constraints, or marketplace request."
              className="w-full resize-y rounded-xl border border-border-soft bg-paper px-4 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-forest/50"
            />
          </FormField>
          <AiCostButton
            className="w-full"
            taskType="brief"
            prompt={brief}
            onClick={() => setBriefAiOpen(true)}
            disabled={!brief.trim()}
          >
            AI extract fields
          </AiCostButton>
        </Section>
        <ConfigSummary values={values} project={project} />
      </div>
      <AiRunSheet
        open={briefAiOpen}
        onOpenChange={setBriefAiOpen}
        mode="text"
        title="AI fill trip configuration"
        description="Extracts structured trip fields from a buyer brief. Preview before applying to the form."
        taskType="brief"
        projectId={project.id}
        sourceLabel="Buyer/client brief"
        prompt={buildBriefExtractionPrompt(project, brief)}
        currentText={tripConfigCurrentValue(values)}
        responseFormat="json"
        validateText={validateBriefOutput}
        onApplyText={applyBriefConfig}
        applyLabel="Replace configuration"
        fillEmptyLabel="Fill empty fields"
        appendLabel="Keep existing fields"
      />
    </form>
  );
}
