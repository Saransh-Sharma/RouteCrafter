"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Import project JSON. Stub for Phase 1 — full parse/validate/persist arrives
 * with the Zod schemas + localStorage layer in Phase 2.
 */
export function ImportProjectButton() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [note, setNote] = React.useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNote(
      `"${file.name}" selected. Import is wired up in Phase 2 (schemas + persistence).`,
    );
    e.target.value = "";
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        Import JSON
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
      />
      {note ? (
        <p className="max-w-xs text-right text-xs text-ink-muted">{note}</p>
      ) : null}
    </div>
  );
}
