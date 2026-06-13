"use client";

import { ArrowRight, Check, Info } from "lucide-react";
import type {
  OfferModel,
  OutputRequirement,
  Project,
  SalesChannel,
} from "@/lib/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { OUTPUT_LABELS, type WorkflowStageId } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  CheckboxChip,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import { TripConfigForm } from "../../trip-config/TripConfigForm";
import { StageHeader } from "./StageHeader";

const OFFER_MODELS: {
  id: OfferModel;
  label: string;
  description: string;
  channels: SalesChannel[];
}[] = [
  {
    id: "digital",
    label: "Digital download",
    description: "A polished, prebuilt itinerary buyers can use immediately.",
    channels: ["etsy", "gumroad"],
  },
  {
    id: "service",
    label: "Custom service",
    description: "A planning offer tailored after the buyer shares a brief.",
    channels: ["fiverr", "direct"],
  },
  {
    id: "hybrid",
    label: "Hybrid offer",
    description: "A ready-made base itinerary with paid personalization.",
    channels: ["etsy", "gumroad", "direct"],
  },
];

const CHANNEL_LABELS: Record<SalesChannel, string> = {
  fiverr: "Fiverr",
  etsy: "Etsy",
  gumroad: "Gumroad",
  direct: "Direct sales",
};

const OUTPUT_GROUPS: {
  label: string;
  description: string;
  outputs: OutputRequirement[];
}[] = [
  {
    label: "Core files",
    description: "Formats the buyer receives.",
    outputs: ["pdf", "spreadsheet"],
  },
  {
    label: "Included guides",
    description: "Useful additions inside every planned edition.",
    outputs: ["food-guide", "packing-list", "booking-checklist"],
  },
  {
    label: "Sales assets",
    description: "Materials used to present and sell the product.",
    outputs: ["marketplace-listing", "portfolio-visuals"],
  },
];

export function DefineStage({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (stage: WorkflowStageId) => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const plan = project.productionPlan;

  function patchProject(patch: Partial<Project>) {
    update(project.id, patch);
  }

  function patchPlan(patch: Partial<Project["productionPlan"]>) {
    patchProject({ productionPlan: { ...plan, ...patch } });
  }

  function chooseOfferModel(offerModel: OfferModel) {
    const model = OFFER_MODELS.find((item) => item.id === offerModel)!;
    const channels = plan.channels.length ? plan.channels : [model.channels[0]];
    patchPlan({ offerModel, channels });
  }

  function toggleChannel(channel: SalesChannel) {
    patchPlan({
      channels: plan.channels.includes(channel)
        ? plan.channels.filter((item) => item !== channel)
        : [...plan.channels, channel],
    });
  }

  function toggleOutput(output: OutputRequirement) {
    if (output === "marketplace-listing") return;
    patchPlan({
      outputs: plan.outputs.includes(output)
        ? plan.outputs.filter((item) => item !== output)
        : [...plan.outputs, output],
    });
  }

  return (
    <div className="space-y-9">
      <StageHeader
        eyebrow="Stage 1 · Define"
        title="Decide what you are selling"
        description="Start with the commercial promise, then shape the trip brief behind it. These choices control which assets RouteCrafter expects before launch."
        aside={
          <div className="text-right">
            <p className="text-sm font-semibold text-ink">
              {OFFER_MODELS.find((model) => model.id === plan.offerModel)?.label}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {plan.outputs.length} launch outputs selected
            </p>
          </div>
        }
      />

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-ink">Offer model</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Pick the closest business model. You can change it later.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {OFFER_MODELS.map((model) => {
            const selected = plan.offerModel === model.id;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => chooseOfferModel(model.id)}
                className={cn(
                  "min-h-36 border px-5 py-5 text-left transition-colors",
                  selected
                    ? "border-forest bg-sage-soft/70"
                    : "border-border-soft bg-paper/35 hover:border-forest/35 hover:bg-paper/70",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-ink">
                    {model.label}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      selected
                        ? "border-forest bg-forest text-paper"
                        : "border-border-strong",
                    )}
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                </span>
                <span className="mt-3 block text-sm leading-6 text-ink-soft">
                  {model.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-8 border-y border-border-soft py-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h3 className="text-xl font-semibold text-ink">Where it will sell</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
            Channel choices tune package and intake requirements without locking
            the project to one marketplace.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(CHANNEL_LABELS) as SalesChannel[]).map((channel) => (
              <CheckboxChip
                key={channel}
                label={CHANNEL_LABELS[channel]}
                selected={plan.channels.includes(channel)}
                onToggle={() => toggleChannel(channel)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Product name" htmlFor="product-name">
            <Input
              id="product-name"
              defaultValue={project.name}
              onBlur={(event) =>
                patchProject({ name: event.target.value.trim() || project.name })
              }
            />
          </FormField>
          <FormField label="Destination" htmlFor="product-country">
            <Input
              id="product-country"
              defaultValue={project.country}
              onBlur={(event) =>
                patchProject({ country: event.target.value.trim() })
              }
            />
          </FormField>
          <FormField label="Target buyer" htmlFor="product-audience">
            <Input
              id="product-audience"
              defaultValue={project.targetAudience}
              onBlur={(event) =>
                patchProject({ targetAudience: event.target.value.trim() })
              }
              placeholder="Who should immediately recognize this as useful?"
            />
          </FormField>
          <FormField label="Brand voice" htmlFor="product-voice">
            <Select
              id="product-voice"
              value={project.brandStyle.voice}
              onChange={(event) =>
                patchProject({
                  brandStyle: {
                    ...project.brandStyle,
                    voice: event.target.value as Project["brandStyle"]["voice"],
                  },
                })
              }
            >
              <option value="editorial">Editorial and warm</option>
              <option value="premium">Premium and understated</option>
              <option value="friendly">Friendly and practical</option>
              <option value="adventurous">Adventurous and energetic</option>
            </Select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              label="Product promise"
              htmlFor="product-positioning"
              hint="One sentence explaining why this itinerary is worth buying."
            >
              <Textarea
                id="product-positioning"
                defaultValue={project.positioning}
                onBlur={(event) =>
                  patchProject({ positioning: event.target.value.trim() })
                }
                rows={3}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h3 className="text-xl font-semibold text-ink">Output package</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Select only what you intend to finish. Every selected output becomes
            part of the publish review.
          </p>
        </div>
        <div className="grid gap-x-10 gap-y-7 lg:grid-cols-3">
          {OUTPUT_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-sm font-semibold text-ink">{group.label}</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                {group.description}
              </p>
              <div className="mt-3 space-y-2">
                {group.outputs.map((output) => {
                  const selected = plan.outputs.includes(output);
                  const required = output === "marketplace-listing";
                  return (
                    <button
                      key={output}
                      type="button"
                      disabled={required}
                      aria-pressed={selected}
                      onClick={() => toggleOutput(output)}
                      className={cn(
                        "flex w-full items-center justify-between border-b border-border-soft py-2 text-left text-sm",
                        selected ? "text-ink" : "text-ink-muted",
                      )}
                    >
                      <span>{OUTPUT_LABELS[output]}</span>
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-sm border",
                          selected
                            ? "border-forest bg-forest text-paper"
                            : "border-border-strong",
                        )}
                      >
                        {selected ? <Check className="size-3" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {plan.outputs.includes("map-pins-legacy") ? (
          <p className="flex items-start gap-2 border border-gold/30 bg-gold-soft/35 p-3 text-xs leading-5 text-brown">
            <Info className="mt-0.5 size-4 shrink-0" />
            This imported project includes Map pins, but RouteCrafter does not
            generate a map-pin artifact yet. It will not block publishing.
          </p>
        ) : null}
      </section>

      <details className="group border-y border-border-soft py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-base font-semibold text-ink">
          Deep trip brief
          <span className="text-xs font-medium text-ink-muted group-open:hidden">
            Pace, budget, logistics, interests, and constraints
          </span>
          <span className="hidden text-xs font-medium text-forest group-open:inline">
            Collapse
          </span>
        </summary>
        <div className="pb-7 pt-3">
          <TripConfigForm project={project} showDeliverables={false} />
        </div>
      </details>

      <div className="flex justify-end">
        <Button onClick={() => onNavigate("plan")}>
          Plan the editions
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
