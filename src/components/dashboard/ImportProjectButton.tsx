"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useProjectsStore } from "@/lib/store/projects-store";
import { importProjectJson } from "@/lib/io/project-io";

/** Import a project from a validated JSON file and open it. */
export function ImportProjectButton() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const importProject = useProjectsStore((s) => s.importProject);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    const text = await file.text();
    const result = importProjectJson(text);
    if (!result.ok || !result.project) {
      setError(result.error ?? "Could not import this file.");
      return;
    }

    try {
      const created = importProject(result.project);
      router.push(`/products/${created.id}`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not save this project.",
      );
    }
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
      {error ? (
        <p className="max-w-xs text-right text-xs text-terracotta">{error}</p>
      ) : null}
    </div>
  );
}
