"use client";

import * as React from "react";
import { Grid3x3, Wand2, RefreshCw, FileDown, ArrowRight } from "lucide-react";
import type { ItineraryMatrix, Project } from "@/lib/types";
import { buildContext, buildMatrix } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import { itineraryMatrixSchema } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { AiRunSheet } from "@/components/ai/AiRunSheet";
import { buildMatrixPrompt } from "@/lib/ai/tasks";
import { parseJsonObject } from "@/lib/ai/parse";
import { appendAiRun, createAiRunMetadata } from "@/lib/ai/metadata";
import { PromptHelper } from "../PromptHelper";
import {
  downloadMatrixCsv,
  downloadMatrixMarkdown,
} from "./export-matrix";
import type { ExpandHint } from "@/lib/store/projects-store";

export function MatrixPanel({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (moduleId: string, hint?: ExpandHint) => void;
}) {
  const update = useProjectsStore((s) => s.update);
  const matrix = project.matrix;
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiFocus, setAiFocus] = React.useState<string | null>(null);

  function generate() {
    update(project.id, { matrix: buildMatrix(buildContext(project)) });
  }

  function updateSpine(cellIndex: number, varIndex: number, spine: string) {
    if (!matrix) return;
    const cells = matrix.cells.map((cell, ci) =>
      ci !== cellIndex
        ? cell
        : {
            ...cell,
            variations: cell.variations.map((v, vi) =>
              vi !== varIndex ? v : { ...v, spine },
            ),
          },
    );
    update(project.id, {
      matrix: { ...matrix, cells, updatedAt: new Date().toISOString() },
    });
  }

  function expand(cellIndex: number) {
    const cell = matrix?.cells[cellIndex];
    if (!cell) return;
    onNavigate("expanded", {
      duration: cell.duration,
      travelerType: cell.travelerType,
    });
  }

  function normalizeMatrix(raw: unknown): ItineraryMatrix {
    const candidate = raw as Partial<ItineraryMatrix>;
    return itineraryMatrixSchema.parse({
      ...candidate,
      id: candidate.id || matrix?.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    });
  }

  function validateMatrix(text: string): string | null {
    try {
      normalizeMatrix(parseJsonObject(text));
      return null;
    } catch {
      return "The model returned matrix JSON RouteCrafter could not safely apply.";
    }
  }

  function mergeMatrix(
    current: ItineraryMatrix | undefined,
    incoming: ItineraryMatrix,
    mode: "replace" | "fill-empty" | "append",
  ): ItineraryMatrix {
    if (!current || mode === "replace") return incoming;
    if (mode === "append") {
      return {
        ...current,
        cells: current.cells.map((cell) => {
          const match = incoming.cells.find(
            (next) =>
              next.duration === cell.duration &&
              next.travelerType === cell.travelerType,
          );
          return match
            ? { ...cell, variations: [...cell.variations, ...match.variations] }
            : cell;
        }),
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      ...current,
      cells: current.cells.map((cell) => {
        const match = incoming.cells.find(
          (next) =>
            next.duration === cell.duration &&
            next.travelerType === cell.travelerType,
        );
        if (!match) return cell;
        return {
          ...cell,
          variations: cell.variations.map((variation, index) =>
            variation.spine.trim()
              ? variation
              : match.variations[index] ?? variation,
          ),
        };
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  function applyAiMatrix(
    text: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
    mode: "replace" | "fill-empty" | "append",
  ) {
    const incoming = normalizeMatrix(parseJsonObject(text));
    update(project.id, {
      matrix: mergeMatrix(matrix, incoming, mode),
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: "matrix",
          label: aiFocus ? "Improved itinerary matrix cell" : "Drafted premium matrix",
          source: "matrix",
        }),
      ),
    });
  }

  if (!matrix || matrix.cells.length === 0) {
    return (
      <div className="space-y-5">
        <PromptHelper project={project} templateIds={["itinerary-matrix"]} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-teal-soft text-teal">
              <Grid3x3 className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold text-ink">
                Build the itinerary matrix
              </p>
              <p className="mx-auto max-w-md text-sm text-ink-soft">
                A compact grid of duration x traveler-type variations to plan
                before expanding any full itinerary.
              </p>
            </div>
            <Button onClick={generate}>
              <Wand2 className="size-4" />
              Generate matrix
            </Button>
            <AiCostButton
              taskType="matrix"
              onClick={() => {
                setAiFocus(null);
                setAiOpen(true);
              }}
            >
              AI draft premium matrix
            </AiCostButton>
          </CardContent>
        </Card>
        <AiRunSheet
          open={aiOpen}
          onOpenChange={setAiOpen}
          mode="text"
          title="AI draft premium matrix"
          description="Creates a structured duration by traveler-type matrix and previews it before replacing anything."
          taskType="matrix"
          sourceLabel="Itinerary matrix"
          prompt={buildMatrixPrompt(project)}
          currentText=""
          responseFormat="json"
          validateText={validateMatrix}
          onApplyText={applyAiMatrix}
          applyLabel="Replace matrix"
          fillEmptyLabel="Fill empty spines"
          appendLabel="Append variations"
        />
      </div>
    );
  }

  const durations = [...new Set(matrix.cells.map((c) => c.duration))];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-ink">Itinerary matrix</h3>
        <div className="flex items-center gap-2">
          <AiCostButton
            size="sm"
            taskType="matrix"
            onClick={() => {
              setAiFocus(null);
              setAiOpen(true);
            }}
          >
            AI draft premium matrix
          </AiCostButton>
          <Button variant="outline" size="sm" onClick={generate}>
            <RefreshCw className="size-4" />
            Regenerate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadMatrixCsv(matrix, project)}
          >
            <FileDown className="size-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadMatrixMarkdown(matrix, project)}
          >
            <FileDown className="size-4" />
            Markdown
          </Button>
        </div>
      </div>

      <PromptHelper project={project} templateIds={["itinerary-matrix"]} />

      {durations.map((duration) => (
        <div key={duration} className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {duration}
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {matrix.cells.map((cell, ci) =>
              cell.duration !== duration ? null : (
                <Card key={`${cell.duration}-${cell.travelerType}`}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="sage">{cell.travelerType}</Badge>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAiFocus(
                              `${cell.duration} ${cell.travelerType} cell`,
                            );
                            setAiOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] px-2 py-1 text-xs font-medium text-[var(--rc-ai-brown)] hover:text-forest"
                        >
                          AI improve
                        </button>
                        <button
                          type="button"
                          onClick={() => expand(ci)}
                          aria-label={`Expand ${cell.duration} ${cell.travelerType}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:text-forest-deep"
                        >
                          Expand
                          <ArrowRight className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {cell.variations.map((v, vi) => (
                        <div key={v.label} className="space-y-1">
                          <label className="text-xs font-semibold text-ink">
                            {v.label}
                          </label>
                          <Textarea
                            value={v.spine}
                            rows={2}
                            onChange={(e) => updateSpine(ci, vi, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        </div>
      ))}
      <AiRunSheet
        open={aiOpen}
        onOpenChange={setAiOpen}
        mode="text"
        title={aiFocus ? `AI improve ${aiFocus}` : "AI draft premium matrix"}
        description="Creates structured matrix JSON and previews it before applying."
        taskType="matrix"
        sourceLabel={aiFocus ?? "Itinerary matrix"}
        prompt={`${buildMatrixPrompt(project, matrix)}${
          aiFocus ? `\n\nFocus only on improving: ${aiFocus}` : ""
        }`}
        currentText={matrix ? JSON.stringify(matrix, null, 2) : ""}
        responseFormat="json"
        validateText={validateMatrix}
        onApplyText={applyAiMatrix}
        applyLabel="Replace matrix"
        fillEmptyLabel="Fill empty spines"
        appendLabel="Append variations"
      />
    </div>
  );
}
