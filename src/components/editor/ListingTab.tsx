"use client";

import { Images } from "lucide-react";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui";
import { ListingPanel } from "@/components/workspace/listing/ListingPanel";
import { ImagePromptsPanel } from "@/components/workspace/image-prompts/ImagePromptsPanel";
import { PromptStudioPanel } from "@/components/workspace/prompts/PromptStudioPanel";

/**
 * Everything the buyer sees before purchase: marketplace listing copy,
 * packages/intake, portfolio visuals, and the copy-paste prompt studio for
 * producing content with any external AI.
 */
export function ListingTab({
  project,
  onOpenTrip,
}: {
  project: Project;
  onOpenTrip: () => void;
}) {
  const outputs = project.productionPlan.outputs;

  return (
    <div className="space-y-10">
      <ListingPanel project={project} showReadyAction={false} />

      <section className="space-y-4 border-t border-border-soft pt-8">
        <div>
          <h3 className="rc-section-title">Portfolio visuals</h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Image briefs for the listing gallery: hero, what-you-get, sample
            pages, and style shots.
          </p>
        </div>
        {outputs.includes("portfolio-visuals") ? (
          <ImagePromptsPanel project={project} />
        ) : (
          <EmptyState
            icon={Images}
            title="Portfolio visuals are not selected"
            description="Add them to the output package in the Trip tab if this offer needs listing graphics or portfolio images."
            action={
              <Button variant="outline" onClick={onOpenTrip}>
                Edit output package
              </Button>
            }
          />
        )}
      </section>

      <details className="group border-t border-border-soft pt-6">
        <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-base font-semibold text-ink">
          <span>Prompt studio</span>
          <span className="text-xs font-medium text-ink-muted group-open:hidden">
            Copy-paste production prompts for any external AI — no API key
            needed
          </span>
          <span className="hidden text-xs font-medium text-forest group-open:inline">
            Collapse
          </span>
        </summary>
        <div className="pt-5">
          <PromptStudioPanel project={project} />
        </div>
      </details>
    </div>
  );
}
