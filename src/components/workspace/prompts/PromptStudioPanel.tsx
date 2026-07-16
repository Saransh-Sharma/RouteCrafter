"use client";

import * as React from "react";
import { Sparkles, RefreshCw, Download, Wand2 } from "lucide-react";
import type { Project } from "@/lib/types";
import {
  buildContext,
  renderTemplate,
  templatesByGroup,
  type PromptTemplate,
} from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OutputBlock } from "@/components/ui/OutputBlock";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { AiRunSheet } from "@/components/ai/AiRunSheet";
import { cn } from "@/lib/utils";
import { appendAiRun, createAiRunMetadata } from "@/lib/ai/metadata";
import { buildPromptRunPrompt } from "@/lib/ai/tasks";
import { markAiRunApplied } from "@/lib/assets/capture";

export function PromptStudioPanel({ project }: { project: Project }) {
  const update = useProjectsStore((s) => s.update);
  const groups = React.useMemo(() => templatesByGroup(), []);
  const allTemplates = React.useMemo(
    () => Object.values(groups).flat(),
    [groups],
  );
  const [activeId, setActiveId] = React.useState(allTemplates[0]?.id ?? "");
  const [aiOpen, setAiOpen] = React.useState(false);
  const active = allTemplates.find((t) => t.id === activeId);

  // Prompt output is ephemeral working material — regenerated on demand from
  // the project, so it is session state rather than part of the project blob.
  const [generated, setGeneratedMap] = React.useState<Record<string, string>>(
    {},
  );
  const value = generated[activeId] ?? "";

  function setGenerated(id: string, text: string) {
    setGeneratedMap((current) => ({ ...current, [id]: text }));
  }

  function generate(id: string) {
    const ctx = buildContext(project);
    setGenerated(id, renderTemplate(id, ctx));
  }

  function generateAll() {
    const ctx = buildContext(project);
    setGeneratedMap((current) => {
      const next = { ...current };
      for (const t of allTemplates) next[t.id] = renderTemplate(t.id, ctx);
      return next;
    });
  }

  function exportRaw() {
    if (!active) return;
    const blob = new Blob([value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.country || "project"}-${active.id}.txt`.toLowerCase();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function applyAiText(
    text: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
    mode: "replace" | "fill-empty" | "append",
  ) {
    if (!active) return;
    const nextText =
      mode === "append" && value
        ? `${value}\n\n---\n\n${text}`
        : mode === "fill-empty" && value
          ? value
          : text;
    setGenerated(active.id, nextText);
    update(project.id, {
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: "prompt",
          label: `Ran ${active.label} with AI`,
          source: active.id,
        }),
      ),
    });
    void markAiRunApplied({ aiRunId: result.aiRunId, projectId: project.id });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Template list */}
      <div className="space-y-5 lg:col-span-1">
        <Button variant="secondary" className="w-full" onClick={generateAll}>
          <Wand2 className="size-4" />
          Generate all prompts
        </Button>
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="space-y-1.5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {group}
            </p>
            {items.map((t) => (
              <TemplateButton
                key={t.id}
                template={t}
                active={t.id === activeId}
                done={Boolean(generated[t.id])}
                onClick={() => setActiveId(t.id)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Active template */}
      <div className="lg:col-span-2">
        {active ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-ink">
                    {active.label}
                  </h3>
                  <Badge tone="neutral">{active.group}</Badge>
                </div>
                <p className="max-w-xl text-sm text-ink-soft">
                  {active.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <AiCostButton
                  size="sm"
                  taskType="prompt"
                  prompt={value}
                  onClick={() => {
                    if (!value && active) generate(active.id);
                    setAiOpen(true);
                  }}
                >
                  Run with AI
                </AiCostButton>
                {value ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generate(active.id)}
                    >
                      <RefreshCw className="size-4" />
                      Regenerate
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportRaw}>
                      <Download className="size-4" />
                      Export raw
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {value ? (
              <OutputBlock
                title={`${active.label} prompt`}
                description="Editable. Copy into ChatGPT, Claude, Gemini, or your image tool."
                value={value}
                rows={20}
                onChange={(next) => setGenerated(active.id, next)}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-sage-soft text-forest">
                    <Sparkles className="size-6" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-ink">
                      Generate the {active.label.toLowerCase()} prompt
                    </p>
                    <p className="mx-auto max-w-sm text-sm text-ink-soft">
                      Builds a copy-paste prompt from this project&apos;s country,
                      trip configuration, and brand voice. No API key needed.
                    </p>
                  </div>
                  <Button onClick={() => generate(active.id)}>
                    <Sparkles className="size-4" />
                    Generate prompt
                  </Button>
                </CardContent>
              </Card>
            )}
            {active ? (
              <AiRunSheet
                open={aiOpen}
                onOpenChange={setAiOpen}
                mode="text"
                title={`Run ${active.label} with AI`}
                description="This sends the generated RouteCrafter prompt to your selected text provider and previews the response before saving."
                taskType="prompt"
                projectId={project.id}
                sourceLabel={active.label}
                prompt={buildPromptRunPrompt(
                  project,
                  value || renderTemplate(active.id, buildContext(project)),
                )}
                currentText={value}
                onApplyText={applyAiText}
                fillEmptyLabel="Save if empty"
                appendLabel="Append to output"
                applyLabel="Save AI output"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TemplateButton({
  template,
  active,
  done,
  onClick,
}: {
  template: PromptTemplate;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? "bg-sage-soft text-forest"
          : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
      )}
    >
      <span className="font-medium">{template.label}</span>
      {done ? (
        <span className="size-1.5 shrink-0 rounded-full bg-forest" />
      ) : null}
    </button>
  );
}
