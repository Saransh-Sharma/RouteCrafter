"use client";

import { Images, Wand2, RefreshCw, FileDown } from "lucide-react";
import type { PortfolioImagePrompt, Project } from "@/lib/types";
import {
  buildContext,
  buildImagePrompt,
  buildImagePrompts,
  type GenerationContext,
} from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ImagePromptCard } from "./ImagePromptCard";
import { downloadImagePromptsMarkdown } from "./export-image-prompts";

export function ImagePromptsPanel({ project }: { project: Project }) {
  const update = useProjectsStore((s) => s.update);
  const prompts = project.imagePrompts;
  const finalCount = prompts.filter((p) => p.isFinal).length;

  function ctx(): GenerationContext {
    return buildContext(project);
  }

  function generateAll() {
    update(project.id, { imagePrompts: buildImagePrompts(ctx()) });
  }

  function setPrompts(next: PortfolioImagePrompt[]) {
    update(project.id, { imagePrompts: next });
  }

  function updateOne(updated: PortfolioImagePrompt) {
    setPrompts(prompts.map((p) => (p.id === updated.id ? updated : p)));
  }

  function regenerateOne(prompt: PortfolioImagePrompt) {
    const fresh = buildImagePrompt(prompt.kind, ctx());
    updateOne({ ...fresh, id: prompt.id, isFinal: prompt.isFinal });
  }

  function toggleFinal(prompt: PortfolioImagePrompt) {
    updateOne({ ...prompt, isFinal: !prompt.isFinal });
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
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="space-y-5">
        {prompts.map((prompt, i) => (
          <ImagePromptCard
            key={prompt.id}
            prompt={prompt}
            index={i}
            onChange={updateOne}
            onRegenerate={() => regenerateOne(prompt)}
            onToggleFinal={() => toggleFinal(prompt)}
          />
        ))}
      </div>
    </div>
  );
}
