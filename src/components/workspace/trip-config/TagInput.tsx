"use client";

import * as React from "react";
import { X } from "lucide-react";

/** Controlled token input; adds on Enter or comma, removes via the chip x. */
export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");

  function commit(raw: string) {
    const next = raw.trim().replace(/,$/, "").trim();
    if (next && !value.includes(next)) onChange([...value, next]);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border-strong bg-paper px-2.5 py-2 focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-sage/40">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-xs font-medium text-forest"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-forest/70 hover:text-forest"
            aria-label={`Remove ${tag}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => draft && commit(draft)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
    </div>
  );
}
