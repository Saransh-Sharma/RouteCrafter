"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  LibraryBig,
  Loader2,
  MapPin,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ExportButton } from "@/components/ui/ExportButton";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton, useToast } from "@/components/ui";
import { ActivityLog } from "@/components/workspace/ActivityLog";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useTemplatesStore } from "@/lib/store/templates-store";
import { useMounted } from "@/lib/hooks";
import { GuidedWorkspace } from "@/components/workspace/guided/GuidedWorkspace";
import { getProjectWorkflow } from "@/lib/workflow";
import { isCloudPersistenceEnabled } from "@/lib/persistence/config";
import { sanitizeProjectForTemplate } from "@/lib/templates";

const statusTone = {
  Draft: "neutral",
  "In progress": "gold",
  "Ready to sell": "sage",
} as const;

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const mounted = useMounted();

  const project = useProjectsStore((s) =>
    s.projects.find((p) => p.id === params.id),
  );
  const duplicate = useProjectsStore((s) => s.duplicate);
  const remove = useProjectsStore((s) => s.remove);
  const refreshProject = useProjectsStore((s) => s.refreshProject);
  const saveTemplate = useTemplatesStore((s) => s.saveTemplate);
  const { toast } = useToast();

  React.useEffect(() => {
    if (params.id) void refreshProject(params.id);
  }, [params.id, refreshProject]);
  const [saveState, setSaveState] = React.useState<{
    status: "idle" | "saving" | "saved" | "error";
    error?: string | null;
  }>({ status: "saved" });
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const handleSaveState = (event: Event) => {
      setSaveState(
        (event as CustomEvent<typeof saveState>).detail ?? { status: "saved" },
      );
    };
    window.addEventListener("routecrafter:save-state", handleSaveState);
    return () =>
      window.removeEventListener("routecrafter:save-state", handleSaveState);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="space-y-4 p-10 text-center">
            <h2 className="text-2xl font-semibold text-ink">
              Project not found
            </h2>
            <p className="text-sm text-ink-soft">
              This project is not available in your current cloud project list.
              It may have been deleted or you may need to refresh your session.
            </p>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-paper transition-colors hover:bg-forest-deep"
            >
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleDuplicate() {
    const copy = duplicate(project!.id);
    if (copy) router.push(`/projects/${copy.id}`);
  }

  function handleDelete() {
    if (
      window.confirm(
        `Delete "${project!.name}"? This cannot be undone.`,
      )
    ) {
      remove(project!.id);
      router.push("/");
    }
  }

  async function handleSaveTemplate(input: {
    name: string;
    description: string;
    includeStarterRoute: boolean;
    includeMappedCoords: boolean;
  }) {
    try {
      await saveTemplate(
        sanitizeProjectForTemplate(project!, {
          name: input.name.trim(),
          description: input.description.trim(),
          includeStarterRoute: input.includeStarterRoute,
          includeMappedCoords: input.includeMappedCoords,
        }),
      );
      setTemplateDialogOpen(false);
      toast({
        message: `Saved “${input.name.trim()}” as a template`,
        tone: "success",
        actionLabel: "View",
        onAction: () => router.push("/templates"),
      });
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not save the template.",
        "error",
      );
    }
  }

  const workflow = getProjectWorkflow(project);
  const cloudPersistence = isCloudPersistenceEnabled();

  return (
    <div className="space-y-7">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-5 border-b border-border-soft pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-terracotta">
            <MapPin className="size-4" />
            {project.country || "No country set"}
          </div>
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={statusTone[project.status]}>{project.status}</Badge>
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                saveState.status === "error"
                  ? "text-terracotta"
                  : "text-ink-muted"
              }`}
              title={saveState.error ?? undefined}
            >
              {saveState.status === "saving" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : saveState.status === "error" ? (
                <AlertCircle className="size-3.5" />
              ) : (
                <Check className="size-3.5 text-forest" />
              )}
              {saveState.status === "saving"
                ? "Saving changes"
                : saveState.status === "error"
                  ? "Save failed"
                  : cloudPersistence
                    ? "Saved to cloud"
                    : "Saved locally"}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="min-w-36 text-right">
            <p className="font-display text-3xl font-semibold text-ink">
              {workflow.progress}%
            </p>
            <p className="text-xs text-ink-muted">route to launch</p>
          </div>
          <details className="relative">
            <summary
              aria-label="Project actions"
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-border-strong bg-paper/60 text-ink-soft hover:border-forest/40 hover:text-ink"
            >
              <MoreHorizontal className="size-4" />
            </summary>
            <div className="absolute right-0 top-12 z-40 w-64 border border-border-strong bg-paper p-2 shadow-[var(--shadow-lift)]">
              <button
                type="button"
                onClick={handleDuplicate}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-soft hover:bg-paper-2/60 hover:text-ink"
              >
                <Copy className="size-4" />
                Duplicate project
              </button>
              <button
                type="button"
                onClick={() => setTemplateDialogOpen(true)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-soft hover:bg-paper-2/60 hover:text-ink"
              >
                <LibraryBig className="size-4" />
                Save as template
              </button>
              <div className="px-1 py-1">
                <ExportButton project={project} />
              </div>
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-terracotta hover:bg-terracotta-soft/45"
              >
                <Trash2 className="size-4" />
                Delete project
              </button>
            </div>
          </details>
        </div>
      </div>

      <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <GuidedWorkspace project={project} />
      </React.Suspense>

      <details className="border-t border-border-soft pt-6">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">
          Project activity
        </summary>
        <div className="pt-5">
          <ActivityLog projectId={project.id} />
        </div>
      </details>
      {templateDialogOpen ? (
        <SaveTemplateDialog
          projectName={project.name}
          defaultDescription={project.positioning}
          onCancel={() => setTemplateDialogOpen(false)}
          onSave={(input) => void handleSaveTemplate(input)}
        />
      ) : null}
    </div>
  );
}

function SaveTemplateDialog({
  projectName,
  defaultDescription,
  onCancel,
  onSave,
}: {
  projectName: string;
  defaultDescription: string;
  onCancel: () => void;
  onSave: (input: {
    name: string;
    description: string;
    includeStarterRoute: boolean;
    includeMappedCoords: boolean;
  }) => void;
}) {
  const [name, setName] = React.useState(`${projectName} starter`);
  const [description, setDescription] = React.useState(defaultDescription);
  const [includeStarterRoute, setIncludeStarterRoute] = React.useState(true);
  const [includeMappedCoords, setIncludeMappedCoords] = React.useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
        className="w-full max-w-lg rounded-2xl border border-border-strong bg-paper p-6 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="rc-label">Save reusable starter</p>
            <h2
              id="save-template-title"
              className="mt-1 text-xl font-semibold text-ink"
            >
              Save as template
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-muted hover:bg-paper-2 hover:text-ink"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Template name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-border-strong bg-paper px-3 text-sm text-ink outline-none focus:border-forest"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border-strong bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-forest"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl border border-border-soft bg-paper-2/40 p-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={includeStarterRoute}
                onChange={(event) => setIncludeStarterRoute(event.target.checked)}
                className="mt-1 accent-[var(--rc-forest)]"
              />
              <span>Include starter routes</span>
            </label>
            <label className="flex items-start gap-2 rounded-xl border border-border-soft bg-paper-2/40 p-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={includeMappedCoords}
                disabled={!includeStarterRoute}
                onChange={(event) => setIncludeMappedCoords(event.target.checked)}
                className="mt-1 accent-[var(--rc-forest)] disabled:opacity-40"
              />
              <span>Include mapped coordinates</span>
            </label>
          </div>
          <div className="rounded-xl border border-border-soft bg-paper-2/35 p-3 text-xs leading-5 text-ink-muted">
            Strips generated assets, image URLs, AI runs, activity, verification
            notes, publish review state, revisions, and project timestamps.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name,
                description,
                includeStarterRoute,
                includeMappedCoords: includeStarterRoute && includeMappedCoords,
              })
            }
            className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-paper hover:bg-forest-deep disabled:opacity-50"
          >
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}
