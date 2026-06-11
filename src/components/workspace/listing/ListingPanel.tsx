"use client";

import { Megaphone, Wand2, RefreshCw, FileDown, Plus, Trash2, BadgeCheck } from "lucide-react";
import type { ListingPackage, MarketplaceListing, Project } from "@/lib/types";
import { buildContext, buildListing } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/field";
import { Section } from "../trip-config/Section";
import { TagInput } from "../trip-config/TagInput";
import { PromptHelper } from "../PromptHelper";
import { downloadListingMarkdown } from "./export-listing";

export function ListingPanel({ project }: { project: Project }) {
  const update = useProjectsStore((s) => s.update);
  const listing = project.listing;

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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-ink">Listing copy</h3>
        <div className="flex flex-wrap items-center gap-2">
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
          {project.status !== "Ready to sell" ? (
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
    </div>
  );
}
