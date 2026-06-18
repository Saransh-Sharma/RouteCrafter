"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  MapPin,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ExportButton } from "@/components/ui/ExportButton";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui";
import { ActivityLog } from "@/components/workspace/ActivityLog";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useMounted } from "@/lib/hooks";
import { GuidedWorkspace } from "@/components/workspace/guided/GuidedWorkspace";
import { getProjectWorkflow } from "@/lib/workflow";
import { isCloudPersistenceEnabled } from "@/lib/persistence/config";

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

  React.useEffect(() => {
    if (params.id) void refreshProject(params.id);
  }, [params.id, refreshProject]);
  const [saveState, setSaveState] = React.useState<{
    status: "idle" | "saving" | "saved" | "error";
    error?: string | null;
  }>({ status: "saved" });

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
    </div>
  );
}
