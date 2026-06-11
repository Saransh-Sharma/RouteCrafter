"use client";

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { Project } from "@/lib/types";
import {
  buildContext,
  renderTemplate,
  templateRegistry,
} from "@/lib/generation";
import { Card } from "@/components/ui/Card";
import { OutputBlock } from "@/components/ui/OutputBlock";
import { cn } from "@/lib/utils";

/**
 * Collapsible "fill with AI" helper. Surfaces the relevant copy-paste prompts
 * for a module so the user can paste the AI output straight into the editable
 * fields below it.
 */
export function PromptHelper({
  project,
  templateIds,
  defaultOpen = false,
}: {
  project: Project;
  templateIds: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const ctx = React.useMemo(() => buildContext(project), [project]);
  const items = templateIds
    .map((id) => templateRegistry[id])
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  if (items.length === 0) return null;

  return (
    <Card className="overflow-hidden border-dashed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <Sparkles className="size-4 text-terracotta" />
          Fill with AI ({items.length} prompt{items.length > 1 ? "s" : ""})
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border-soft px-5 py-5">
          <p className="text-xs text-ink-muted">
            Copy a prompt, run it in ChatGPT, Claude, or Gemini, then paste the
            result into the fields below and refine.
          </p>
          {items.map((t) => (
            <OutputBlock
              key={t.id}
              title={t.label}
              description={t.description}
              value={renderTemplate(t.id, ctx)}
              readOnly
              rows={10}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
}
