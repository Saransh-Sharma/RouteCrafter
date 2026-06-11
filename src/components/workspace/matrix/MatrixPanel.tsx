"use client";

import * as React from "react";
import { Grid3x3, Wand2, RefreshCw, FileDown, ArrowRight } from "lucide-react";
import type { Project } from "@/lib/types";
import { buildContext, buildMatrix } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/field";
import { PromptHelper } from "../PromptHelper";
import {
  downloadMatrixCsv,
  downloadMatrixMarkdown,
} from "./export-matrix";

export function MatrixPanel({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (moduleId: string) => void;
}) {
  const update = useProjectsStore((s) => s.update);
  const setExpandHint = useProjectsStore((s) => s.setExpandHint);
  const matrix = project.matrix;

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
    setExpandHint({ duration: cell.duration, travelerType: cell.travelerType });
    onNavigate("expanded");
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const durations = [...new Set(matrix.cells.map((c) => c.duration))];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-ink">Itinerary matrix</h3>
        <div className="flex items-center gap-2">
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
                      <button
                        type="button"
                        onClick={() => expand(ci)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:text-forest-deep"
                      >
                        Expand
                        <ArrowRight className="size-3.5" />
                      </button>
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
    </div>
  );
}
