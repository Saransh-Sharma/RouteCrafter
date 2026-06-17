"use client";

import * as React from "react";
import { Images, Wand2, RefreshCw, FileDown } from "lucide-react";
import type { PortfolioImagePrompt, Project } from "@/lib/types";
import {
  buildContext,
  buildImagePrompt,
  buildImagePrompts,
  imagePromptToText,
  type GenerationContext,
} from "@/lib/generation";
import { portfolioImagePromptSchema } from "@/lib/schemas";
import { useProjectsStore } from "@/lib/store/projects-store";
import { editionLabel } from "@/lib/workflow";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField, Select } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { AiRunSheet } from "@/components/ai/AiRunSheet";
import {
  buildImageGenerationPrompt,
  buildImagePromptImprovementPrompt,
} from "@/lib/ai/tasks";
import { parseJsonObject } from "@/lib/ai/parse";
import { appendAiRun, createAiRunMetadata } from "@/lib/ai/metadata";
import {
  captureAsset,
  dataUrlToBlob,
  isDataUrl,
  markAiRunApplied,
  recordAssetUsage,
} from "@/lib/assets/capture";
import { isCloudPersistenceEnabled } from "@/lib/persistence/config";
import { ImagePromptCard } from "./ImagePromptCard";
import { downloadImagePromptsMarkdown } from "./export-image-prompts";

export function ImagePromptsPanel({ project }: { project: Project }) {
  const update = useProjectsStore((s) => s.update);
  const prompts = project.imagePrompts;
  const finalCount = prompts.filter((p) => p.isFinal).length;
  const editions = project.productionPlan.editions;
  const [editionId, setEditionId] = React.useState<string>("");
  const [aiTarget, setAiTarget] = React.useState<
    | { mode: "improve"; prompt: PortfolioImagePrompt }
    | { mode: "image"; prompt: PortfolioImagePrompt }
    | null
  >(null);

  const extraCities =
    editions.find((edition) => edition.id === editionId)?.cities ?? [];

  function ctx(): GenerationContext {
    return buildContext(project, { extraCities });
  }

  function generateAll() {
    update(project.id, { imagePrompts: buildImagePrompts(ctx()) });
  }

  function setPrompts(next: PortfolioImagePrompt[]): boolean {
    return update(project.id, { imagePrompts: next }).ok;
  }

  function updateOne(updated: PortfolioImagePrompt): boolean {
    return setPrompts(prompts.map((p) => (p.id === updated.id ? updated : p)));
  }

  function regenerateOne(prompt: PortfolioImagePrompt) {
    const fresh = buildImagePrompt(prompt.kind, ctx());
    updateOne({ ...fresh, id: prompt.id, isFinal: prompt.isFinal });
  }

  async function toggleFinal(prompt: PortfolioImagePrompt) {
    if (!prompt.isFinal && prompt.image && isDataUrl(prompt.image)) {
      try {
        const asset = await captureAsset({
          projectId: project.id,
          assetType: "portfolio-visual",
          source: "ai-generation",
          file: dataUrlToBlob(prompt.image),
          filename: `${project.country || "project"}-${prompt.kind}.png`,
          usageType: "portfolio-visual",
          entityId: prompt.id,
          fieldPath: "imagePrompts[].image",
        });
        if (updateOne({ ...prompt, image: asset.blobUrl, isFinal: true })) {
          await recordAssetUsage({
            assetId: asset.id,
            usageType: "portfolio-visual",
            entityId: prompt.id,
            fieldPath: "imagePrompts[].image",
          }).catch(() => undefined);
        }
        return;
      } catch {
        // Keep the existing final toggle available if the cloud capture fails.
      }
    }
    updateOne({ ...prompt, isFinal: !prompt.isFinal });
  }

  function validatePrompt(text: string): string | null {
    try {
      portfolioImagePromptSchema.parse(parseJsonObject(text));
      return null;
    } catch {
      return "The model returned image prompt JSON RouteCrafter could not safely apply.";
    }
  }

  function mergePromptFields(
    current: PortfolioImagePrompt,
    incoming: PortfolioImagePrompt,
    mode: "replace" | "fill-empty" | "append",
  ): PortfolioImagePrompt {
    const preserved = {
      id: current.id,
      kind: current.kind,
      isFinal: current.isFinal,
      image: current.image,
    };
    if (mode === "replace") return { ...incoming, ...preserved };
    const next = { ...current };
    const fields: Array<keyof PortfolioImagePrompt> = [
      "title",
      "goal",
      "canvas",
      "layout",
      "visualElements",
      "textOverlay",
      "style",
      "negativePrompt",
      "countryAccuracyNotes",
      "readabilityNotes",
    ];
    for (const field of fields) {
      const value = incoming[field];
      if (typeof value !== "string" || !value.trim()) continue;
      if (mode === "fill-empty") {
        if (!String(next[field] ?? "").trim()) {
          next[field] = value as never;
        }
      } else {
        const currentValue = String(next[field] ?? "").trim();
        next[field] = (currentValue ? `${currentValue}\n\n${value}` : value) as never;
      }
    }
    return portfolioImagePromptSchema.parse(next);
  }

  function applyImprovedPrompt(
    text: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
    mode: "replace" | "fill-empty" | "append",
  ) {
    if (!aiTarget || aiTarget.mode !== "improve") return;
    const incoming = portfolioImagePromptSchema.parse(parseJsonObject(text));
    updateOne(mergePromptFields(aiTarget.prompt, incoming, mode));
    update(project.id, {
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: "imagePrompt",
          label: `Improved ${aiTarget.prompt.title}`,
          source: "image-prompts",
        }),
      ),
    });
    void markAiRunApplied({ aiRunId: result.aiRunId, projectId: project.id });
  }

  async function applyGeneratedImage(
    image: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
  ) {
    if (!aiTarget || aiTarget.mode !== "image") return;
    let imageUrl = image;
    let assetId: string | undefined;
    if (isDataUrl(image) && isCloudPersistenceEnabled()) {
      try {
        const asset = await captureAsset({
          projectId: project.id,
          assetType: "portfolio-visual",
          source: "ai-generation",
          file: dataUrlToBlob(image),
          filename: `${project.country || "project"}-${aiTarget.prompt.kind}.png`,
          usageType: "portfolio-visual",
          entityId: aiTarget.prompt.id,
          fieldPath: "imagePrompts[].image",
        });
        imageUrl = asset.blobUrl;
        assetId = asset.id;
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? error.message
            : "Could not save the generated image asset.",
        );
      }
    }
    const applied = updateOne({ ...aiTarget.prompt, image: imageUrl });
    if (!applied) return;
    if (assetId) {
      await recordAssetUsage({
        assetId,
        usageType: "portfolio-visual",
        entityId: aiTarget.prompt.id,
        fieldPath: "imagePrompts[].image",
      }).catch(() => undefined);
    }
    update(project.id, {
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: "imageGeneration",
          label: `Created image for ${aiTarget.prompt.title}`,
          source: "image-prompts",
        }),
      ),
    });
    void markAiRunApplied({
      aiRunId: result.aiRunId,
      projectId: project.id,
      assetId,
    });
  }

  if (prompts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-terracotta-soft text-terracotta">
            <Images className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-base font-semibold text-ink">
              Generate five portfolio image prompts
            </p>
            <p className="mx-auto max-w-md text-sm text-ink-soft">
              Hero thumbnail, what you&apos;ll get, sample itinerary, the method
              behind it, and built-around-your-style — tailored to{" "}
              {project.country || "your country"}.
            </p>
          </div>
          <Button onClick={generateAll}>
            <Wand2 className="size-4" />
            Generate all five
          </Button>
          <AiCostButton taskType="imagePrompt" onClick={generateAll} disabled>
            AI actions unlock after prompts exist
          </AiCostButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-ink">
            Portfolio image prompts
          </h3>
          <Badge tone="sage">{finalCount} / 5 final</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={generateAll}>
            <RefreshCw className="size-4" />
            Regenerate all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadImagePromptsMarkdown(project)}
          >
            <FileDown className="size-4" />
            Export Markdown
          </Button>
          <AiCostButton
            size="sm"
            mode="image"
            taskType="imageGeneration"
            prompt={prompts[0] ? JSON.stringify(prompts[0]) : ""}
            onClick={() =>
              prompts[0] && setAiTarget({ mode: "image", prompt: prompts[0] })
            }
          >
            AI create hero image
          </AiCostButton>
        </div>
      </div>

      {editions.length ? (
        <FormField
          label="Tailor cities to an edition"
          hint="Adds that edition's custom cities/regions on top of the brief cities for image prompts."
        >
          <Select
            value={editionId}
            onChange={(event) => setEditionId(event.target.value)}
          >
            <option value="">Project-wide (brief cities)</option>
            {editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {editionLabel(edition)}
                {edition.cities.length ? ` · +${edition.cities.length} cities` : ""}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      <div className="space-y-5">
        {prompts.map((prompt, i) => (
          <ImagePromptCard
            key={prompt.id}
            prompt={prompt}
            index={i}
            onChange={updateOne}
            onRegenerate={() => regenerateOne(prompt)}
            onToggleFinal={() => toggleFinal(prompt)}
            onAiImprove={() => setAiTarget({ mode: "improve", prompt })}
            onAiCreateImage={() => setAiTarget({ mode: "image", prompt })}
          />
        ))}
      </div>
      <AiRunSheet
        open={Boolean(aiTarget)}
        onOpenChange={(open) => {
          if (!open) setAiTarget(null);
        }}
        mode={aiTarget?.mode === "image" ? "image" : "text"}
        title={
          aiTarget?.mode === "image"
            ? "AI create portfolio image"
            : "AI improve image prompt"
        }
        description={
          aiTarget?.mode === "image"
            ? "Image generation can be more expensive than text. Preview before applying to this prompt card."
            : "Improves the structured image prompt while preserving the prompt slot."
        }
        taskType={
          aiTarget?.mode === "image" ? "imageGeneration" : "imagePrompt"
        }
        projectId={project.id}
        sourceLabel={aiTarget?.prompt.title ?? "Image prompt"}
        prompt={
          aiTarget
            ? aiTarget.mode === "image"
              ? buildImageGenerationPrompt(
                  project,
                  imagePromptToText(aiTarget.prompt),
                  aiTarget.prompt.title,
                  extraCities,
                )
              : buildImagePromptImprovementPrompt(
                  project,
                  aiTarget.prompt,
                  extraCities,
                )
            : ""
        }
        currentText={aiTarget ? JSON.stringify(aiTarget.prompt, null, 2) : ""}
        responseFormat={aiTarget?.mode === "image" ? undefined : "json"}
        validateText={aiTarget?.mode === "image" ? undefined : validatePrompt}
        onApplyText={applyImprovedPrompt}
        onApplyImage={applyGeneratedImage}
        applyLabel="Replace prompt"
        fillEmptyLabel="Fill empty fields"
        appendLabel="Append to prompt fields"
      />
    </div>
  );
}
