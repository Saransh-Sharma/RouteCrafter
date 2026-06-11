"use client";

import * as React from "react";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

export interface OutputBlockProps {
  title?: string;
  description?: string;
  value: string;
  /** When true the textarea is read-only (display-only output). */
  readOnly?: boolean;
  rows?: number;
  className?: string;
  onChange?: (value: string) => void;
}

/**
 * An editable, copyable output surface used throughout the studio for
 * generated text (prompts, sections, listing copy).
 */
export function OutputBlock({
  title,
  description,
  value,
  readOnly = false,
  rows = 8,
  className,
  onChange,
}: OutputBlockProps) {
  const [internal, setInternal] = React.useState(value);
  const [prevValue, setPrevValue] = React.useState(value);

  // Sync uncontrolled state when the incoming value changes (e.g. on
  // regeneration) using the recommended "adjust state during render" pattern.
  if (!onChange && value !== prevValue) {
    setPrevValue(value);
    setInternal(value);
  }

  const current = onChange ? value : internal;

  function handleChange(next: string) {
    if (onChange) onChange(next);
    else setInternal(next);
  }

  return (
    <div className={cn("rc-card overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border-soft bg-paper-2/40 px-4 py-3">
        <div className="min-w-0">
          {title ? (
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
          ) : null}
        </div>
        <CopyButton value={current} />
      </div>
      <textarea
        value={current}
        readOnly={readOnly}
        rows={rows}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        className={cn(
          "w-full resize-y bg-paper px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-muted",
          readOnly && "cursor-default",
        )}
      />
    </div>
  );
}
