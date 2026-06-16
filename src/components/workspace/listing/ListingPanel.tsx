"use client";

import * as React from "react";
import {
  BadgeCheck,
  FileDown,
  Megaphone,
  Plus,
  RefreshCw,
  Trash2,
  Wand2,
} from "lucide-react";
import type { ListingPackage, MarketplaceListing, Project } from "@/lib/types";
import { buildContext, buildListing } from "@/lib/generation";
import { marketplaceListingSchema } from "@/lib/schemas";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { AiRunSheet } from "@/components/ai/AiRunSheet";
import { buildListingPrompt } from "@/lib/ai/tasks";
import { parseJsonObject } from "@/lib/ai/parse";
import { appendAiRun, createAiRunMetadata } from "@/lib/ai/metadata";
import { Section } from "../trip-config/Section";
import { TagInput } from "../trip-config/TagInput";
import { PromptHelper } from "../PromptHelper";
import { downloadListingMarkdown } from "./export-listing";

export function ListingPanel({
  project,
  showReadyAction = true,
}: {
  project: Project;
  showReadyAction?: boolean;
}) {
  const update = useProjectsStore((s) => s.update);
  const listing = project.listing;
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiFocus, setAiFocus] = React.useState("Improve the complete listing.");
  const [marketplaceTone, setMarketplaceTone] = React.useState("Premium concierge");

  function generate() {
    update(project.id, { listing: buildListing(buildContext(project)) });
  }

  function patch(next: Partial<MarketplaceListing>) {
    if (!listing) return;
    update(project.id, { listing: { ...listing, ...next } });
  }

  function setPackage(index: number, next: Partial<ListingPackage>) {
    if (!listing) return;
    patch({
      packages: listing.packages.map((p, i) =>
        i === index ? { ...p, ...next } : p,
      ),
    });
  }

  function markReadyToSell() {
    update(project.id, { status: "Ready to sell" });
  }

  function normalizeListing(text: string): MarketplaceListing {
    return marketplaceListingSchema.parse(parseJsonObject(text));
  }

  function validateListing(text: string): string | null {
    try {
      normalizeListing(text);
      return null;
    } catch {
      return "The model returned listing JSON RouteCrafter could not safely apply.";
    }
  }

  function mergeListing(
    current: MarketplaceListing | undefined,
    incoming: MarketplaceListing,
    mode: "replace" | "fill-empty" | "append",
  ): MarketplaceListing {
    if (!current || mode === "replace") return incoming;
    if (mode === "append") {
      return {
        ...current,
        titleOptions: [...current.titleOptions, ...incoming.titleOptions],
        tags: [...new Set([...current.tags, ...incoming.tags])],
        packages: [...current.packages, ...incoming.packages],
        faqs: [...current.faqs, ...incoming.faqs],
        buyerRequirements: [
          ...current.buyerRequirements,
          ...incoming.buyerRequirements,
        ],
        upsells: [...current.upsells, ...incoming.upsells],
        deliveryNotes: [current.deliveryNotes, incoming.deliveryNotes]
          .filter(Boolean)
          .join("\n\n"),
      };
    }
    return {
      ...current,
      titleOptions: current.titleOptions.length
        ? current.titleOptions
        : incoming.titleOptions,
      tags: current.tags.length ? current.tags : incoming.tags,
      shortDescription:
        current.shortDescription || incoming.shortDescription,
      longDescription: current.longDescription || incoming.longDescription,
      packages: current.packages.length ? current.packages : incoming.packages,
      faqs: current.faqs.length ? current.faqs : incoming.faqs,
      buyerRequirements: current.buyerRequirements.length
        ? current.buyerRequirements
        : incoming.buyerRequirements,
      upsells: current.upsells.length ? current.upsells : incoming.upsells,
      deliveryNotes: current.deliveryNotes || incoming.deliveryNotes,
    };
  }

  function applyAiListing(
    text: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
    mode: "replace" | "fill-empty" | "append",
  ) {
    const incoming = normalizeListing(text);
    update(project.id, {
      listing: mergeListing(listing, incoming, mode),
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: "listing",
          label: aiFocus,
          source: "listing",
        }),
      ),
    });
  }

  const aiSheet = (
    <AiRunSheet
      open={aiOpen}
      onOpenChange={setAiOpen}
      mode="text"
      title="AI improve listing"
      description="Creates structured marketplace listing copy and previews field-level JSON before applying."
      taskType="listing"
      sourceLabel="Listing copy"
      prompt={buildListingPrompt(project, listing, aiFocus, marketplaceTone)}
      currentText={listing ? JSON.stringify(listing, null, 2) : ""}
      responseFormat="json"
      validateText={validateListing}
      onApplyText={applyAiListing}
      applyLabel="Replace listing"
      fillEmptyLabel="Fill empty sections"
      appendLabel="Append new options"
    />
  );

  if (!listing) {
    return (
      <div className="space-y-5">
        <PromptHelper
          project={project}
          templateIds={["listing-copy", "faq", "buyer-requirements"]}
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-teal-soft text-teal">
              <Megaphone className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold text-ink">
                Build your listing copy
              </p>
              <p className="mx-auto max-w-md text-sm text-ink-soft">
                Titles, tags, descriptions, packages, FAQs, and buyer
                requirements - scaffolded from this project.
              </p>
            </div>
            <Button onClick={generate}>
              <Wand2 className="size-4" />
              Generate listing
            </Button>
            <AiCostButton
              taskType="listing"
              onClick={() => {
                setAiFocus("Create a complete listing from the trip config.");
                setAiOpen(true);
              }}
            >
              AI improve listing
            </AiCostButton>
          </CardContent>
        </Card>
        {aiSheet}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-ink">Listing copy</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={marketplaceTone}
            onChange={(event) => setMarketplaceTone(event.target.value)}
            className="h-9 w-auto"
          >
            <option>Fiverr direct</option>
            <option>Etsy polished</option>
            <option>Gumroad editorial</option>
            <option>Premium concierge</option>
          </Select>
          <AiCostButton
            size="sm"
            taskType="listing"
            onClick={() => {
              setAiFocus("Improve the complete listing.");
              setAiOpen(true);
            }}
          >
            AI improve listing
          </AiCostButton>
          <Button variant="outline" size="sm" onClick={generate}>
            <RefreshCw className="size-4" />
            Regenerate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadListingMarkdown(listing, project)}
          >
            <FileDown className="size-4" />
            Markdown
          </Button>
          {showReadyAction && project.status !== "Ready to sell" ? (
            <Button variant="secondary" size="sm" onClick={markReadyToSell}>
              <BadgeCheck className="size-4" />
              Mark ready to sell
            </Button>
          ) : null}
        </div>
      </div>

      <PromptHelper
        project={project}
        templateIds={["listing-copy", "faq", "buyer-requirements"]}
      />

      <Section title="Titles & tags">
        <FormField label="Title options">
          <div className="space-y-2">
            {listing.titleOptions.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={t}
                  onChange={(e) =>
                    patch({
                      titleOptions: listing.titleOptions.map((x, xi) =>
                        xi === i ? e.target.value : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      titleOptions: listing.titleOptions.filter(
                        (_, xi) => xi !== i,
                      ),
                    })
                  }
                  aria-label="Remove title"
                  className="shrink-0 rounded-lg p-2 text-ink-soft hover:bg-terracotta/10 hover:text-terracotta"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                patch({ titleOptions: [...listing.titleOptions, ""] })
              }
            >
              <Plus className="size-4" />
              Add title
            </Button>
            <AiCostButton
              size="sm"
              taskType="listing"
              onClick={() => {
                setAiFocus("Generate stronger marketplace title options.");
                setAiOpen(true);
              }}
            >
              AI stronger titles
            </AiCostButton>
          </div>
        </FormField>
        <FormField label="Tags">
          <TagInput
            value={listing.tags}
            onChange={(tags) => patch({ tags })}
            placeholder="Add a tag and press Enter"
          />
        </FormField>
      </Section>

      <Section title="Descriptions">
        <FormField label="Short description">
          <Textarea
            value={listing.shortDescription}
            rows={2}
            onChange={(e) => patch({ shortDescription: e.target.value })}
          />
        </FormField>
        <FormField label="Long description">
          <Textarea
            value={listing.longDescription}
            rows={6}
            onChange={(e) => patch({ longDescription: e.target.value })}
          />
        </FormField>
      </Section>

      <Section title="Packages">
        <div className="space-y-4">
          {listing.packages.map((pkg, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Name">
                    <Input
                      value={pkg.name}
                      onChange={(e) => setPackage(i, { name: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Price">
                    <Input
                      value={pkg.price}
                      onChange={(e) => setPackage(i, { price: e.target.value })}
                      placeholder="e.g. $45"
                    />
                  </FormField>
                </div>
                <FormField label="Description">
                  <Textarea
                    value={pkg.description}
                    rows={2}
                    onChange={(e) =>
                      setPackage(i, { description: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Features">
                  <TagInput
                    value={pkg.features}
                    onChange={(features) => setPackage(i, { features })}
                    placeholder="Add a feature and press Enter"
                  />
                </FormField>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="FAQ">
        <div className="space-y-4">
          {listing.faqs.map((faq, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-3">
                    <FormField label="Question">
                      <Input
                        value={faq.question}
                        onChange={(e) =>
                          patch({
                            faqs: listing.faqs.map((x, xi) =>
                              xi === i
                                ? { ...x, question: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Answer">
                      <Textarea
                        value={faq.answer}
                        rows={2}
                        onChange={(e) =>
                          patch({
                            faqs: listing.faqs.map((x, xi) =>
                              xi === i ? { ...x, answer: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </FormField>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      patch({ faqs: listing.faqs.filter((_, xi) => xi !== i) })
                    }
                    aria-label="Remove FAQ"
                    className="shrink-0 rounded-lg p-2 text-ink-soft hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                faqs: [...listing.faqs, { question: "", answer: "" }],
              })
            }
          >
            <Plus className="size-4" />
            Add FAQ
          </Button>
          <AiCostButton
            size="sm"
            taskType="listing"
            onClick={() => {
              setAiFocus("Improve FAQ answers and add useful buyer questions.");
              setAiOpen(true);
            }}
          >
            AI improve FAQ
          </AiCostButton>
        </div>
      </Section>

      <Section title="Requirements, upsells & delivery">
        <FormField label="Buyer requirements">
          <TagInput
            value={listing.buyerRequirements}
            onChange={(buyerRequirements) => patch({ buyerRequirements })}
            placeholder="Add a requirement and press Enter"
          />
        </FormField>
        <FormField label="Upsells">
          <TagInput
            value={listing.upsells}
            onChange={(upsells) => patch({ upsells })}
            placeholder="Add an upsell and press Enter"
          />
        </FormField>
        <FormField label="Delivery notes">
          <Textarea
            value={listing.deliveryNotes}
            rows={2}
            onChange={(e) => patch({ deliveryNotes: e.target.value })}
          />
        </FormField>
      </Section>
      {aiSheet}
    </div>
  );
}
