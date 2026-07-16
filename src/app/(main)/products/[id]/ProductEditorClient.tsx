"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ImagePlus,
  Layers,
  LibraryBig,
  MapPin,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton, useToast } from "@/components/ui";
import { Dialog, DialogActions } from "@/components/ui/overlay/Dialog";
import { Menu } from "@/components/ui/overlay/Menu";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/field";
import { ActivityLog } from "@/components/workspace/ActivityLog";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useTemplatesStore } from "@/lib/store/templates-store";
import { useMounted } from "@/lib/hooks";
import { sanitizeProjectForTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";
import {
  EDITOR_TABS,
  isEditorTab,
  tabForIssue,
  type EditorTab,
} from "@/components/editor/tabs";
import { TripTab } from "@/components/editor/TripTab";
import { ItineraryTab } from "@/components/editor/ItineraryTab";
import { PdfTab } from "@/components/editor/PdfTab";
import { ListingTab } from "@/components/editor/ListingTab";
import { ReadinessPopover } from "@/components/editor/ReadinessPopover";
import { ExportMenu } from "@/components/editor/ExportMenu";
import { MediaDrawer } from "@/components/editor/MediaDrawer";
import { MultiplyDialog } from "@/components/series/MultiplyDialog";
import type { WorkflowStageId } from "@/lib/readiness";

const statusTone = {
  Draft: "neutral",
  "In progress": "gold",
  "Ready to sell": "sage",
} as const;

export default function ProductEditorClient({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mounted = useMounted();

  const project = useProjectsStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );
  const duplicate = useProjectsStore((s) => s.duplicate);
  const remove = useProjectsStore((s) => s.remove);
  const refreshProject = useProjectsStore((s) => s.refreshProject);
  const saveTemplate = useTemplatesStore((s) => s.saveTemplate);
  const { toast } = useToast();
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
  const [multiplyOpen, setMultiplyOpen] = React.useState(false);
  const [coverDrawerOpen, setCoverDrawerOpen] = React.useState(false);
  const update = useProjectsStore((s) => s.update);

  React.useEffect(() => {
    if (projectId) void refreshProject(projectId);
  }, [projectId, refreshProject]);

  // Tab state is URL-driven so browser Back/Forward and deep links work.
  const requestedTab = searchParams.get("tab");
  const legacyStage = searchParams.get("stage") as WorkflowStageId | null;
  const activeTab: EditorTab = isEditorTab(requestedTab)
    ? requestedTab
    : legacyStage
      ? tabForIssue(legacyStage, searchParams.get("tool") ?? undefined)
      : "trip";

  const navigate = React.useCallback(
    (tab: EditorTab, params: { edition?: string; section?: string } = {}) => {
      const previous = searchParams.get("tab");
      const next = new URLSearchParams();
      next.set("tab", tab);
      if (params.edition) next.set("edition", params.edition);
      if (params.section) next.set("section", params.section);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
      if (previous !== tab) window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pathname, router, searchParams],
  );

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-[var(--radius-band)]" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="space-y-4 p-10 text-center">
            <h2 className="text-title font-display text-ink">
              Product not found
            </h2>
            <p className="text-sm text-ink-soft">
              This product is not available in your current cloud list. It may
              have been deleted or you may need to refresh your session.
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
    if (copy) router.push(`/products/${copy.id}`);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${project!.name}"? This cannot be undone.`)) {
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
        onAction: () => router.push("/products/new?mode=template"),
      });
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not save the template.",
        "error",
      );
    }
  }

  const coverImage =
    project.coverImage ||
    project.itineraries.find((itinerary) => itinerary.coverImage)?.coverImage;

  return (
    <div className="space-y-7">
      {/* Editorial header band */}
      <header
        className={cn(
          "rc-cover-band relative isolate min-h-44 sm:min-h-52",
          !coverImage && "bg-gradient-to-br from-sage-soft via-paper to-gold-soft/60",
        )}
      >
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            unoptimized
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ) : null}
        <div className="relative z-10 flex h-full min-h-44 flex-col justify-between gap-4 p-5 sm:min-h-52 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <Link
              href="/"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold backdrop-blur-sm transition-colors",
                coverImage
                  ? "bg-ink/30 text-paper hover:bg-ink/45"
                  : "bg-paper/70 text-ink-soft hover:text-ink",
              )}
            >
              <ArrowLeft className="size-3.5" />
              Products
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMultiplyOpen(true)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-caption font-semibold backdrop-blur-sm transition-colors",
                  coverImage
                    ? "border-paper/40 bg-ink/30 text-paper hover:bg-ink/45"
                    : "border-border-strong bg-paper/70 text-ink-soft hover:border-forest/40 hover:text-ink",
                )}
              >
                <Layers className="size-4" aria-hidden />
                <span className="hidden sm:inline">Multiply</span>
              </button>
              <ReadinessPopover project={project} onNavigate={navigate} />
              <ExportMenu project={project} onNavigate={navigate} />
              <Menu
                align="end"
                trigger={(props) => (
                  <button
                    type="button"
                    aria-label="Project actions"
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors",
                      coverImage
                        ? "border-paper/40 bg-ink/30 text-paper hover:bg-ink/45"
                        : "border-border-strong bg-paper/70 text-ink-soft hover:border-forest/40 hover:text-ink",
                    )}
                    {...props}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                )}
                items={[
                  {
                    label: "Multiply across countries",
                    icon: <Layers className="size-4" />,
                    onSelect: () => setMultiplyOpen(true),
                  },
                  {
                    label: "Change cover image",
                    icon: <ImagePlus className="size-4" />,
                    onSelect: () => setCoverDrawerOpen(true),
                  },
                  {
                    label: "Duplicate product",
                    icon: <Copy className="size-4" />,
                    onSelect: handleDuplicate,
                  },
                  {
                    label: "Save as template",
                    icon: <LibraryBig className="size-4" />,
                    onSelect: () => setTemplateDialogOpen(true),
                  },
                  {
                    label: "Delete product",
                    icon: <Trash2 className="size-4" />,
                    danger: true,
                    onSelect: handleDelete,
                  },
                ]}
              />
            </div>
          </div>
          <div>
            <p
              className={cn(
                "flex items-center gap-1.5 text-caption font-semibold",
                coverImage ? "text-paper/90" : "text-terracotta",
              )}
            >
              <MapPin className="size-3.5" />
              {project.country || "No country set"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1
                className={cn(
                  "font-display text-title font-semibold sm:text-display",
                  coverImage ? "text-paper" : "text-ink",
                )}
              >
                {project.name}
              </h1>
              <Badge tone={statusTone[project.status]}>{project.status}</Badge>
              {project.series ? (
                <Link
                  href={`/series/${project.series.seriesId}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors",
                    coverImage
                      ? "bg-ink/30 text-paper hover:bg-ink/45"
                      : "bg-paper/70 text-ink-soft hover:text-ink",
                  )}
                >
                  <Layers className="size-3" aria-hidden />
                  {project.series.seriesName || "Series"}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav
        role="tablist"
        aria-label="Product editor sections"
        className="sticky top-[3.25rem] z-20 -mx-5 flex gap-1 overflow-x-auto border-b border-border-soft bg-ivory/85 px-5 backdrop-blur sm:-mx-8 sm:px-8 md:top-[3.4rem]"
      >
        {EDITOR_TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => navigate(tab.id)}
              className={cn(
                "relative shrink-0 px-4 py-3 text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage",
                active ? "text-ink" : "text-ink-muted hover:text-ink-soft",
              )}
            >
              {tab.label}
              {active ? (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-forest" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2">
        {activeTab === "trip" ? (
          <TripTab
            project={project}
            onOpenItinerary={(editionId) =>
              navigate("itinerary", { edition: editionId, section: "overview" })
            }
          />
        ) : activeTab === "itinerary" ? (
          <ItineraryTab
            project={project}
            editionId={searchParams.get("edition")}
            section={searchParams.get("section") ?? searchParams.get("tool")}
            onSelectEdition={(editionId) =>
              navigate("itinerary", {
                edition: editionId,
                section: searchParams.get("section") ?? "overview",
              })
            }
            onSectionChange={(section) =>
              navigate("itinerary", {
                edition: searchParams.get("edition") ?? undefined,
                section,
              })
            }
            onOpenTrip={() => navigate("trip")}
          />
        ) : activeTab === "pdf" ? (
          <PdfTab
            project={project}
            onOpenTrip={() => navigate("trip")}
            onOpenItinerary={(editionId) =>
              navigate("itinerary", { edition: editionId, section: "overview" })
            }
          />
        ) : (
          <ListingTab project={project} onOpenTrip={() => navigate("trip")} />
        )}
      </div>

      <details className="border-t border-border-soft pt-6">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">
          Project activity
        </summary>
        <div className="pt-5">
          <ActivityLog projectId={project.id} />
        </div>
      </details>

      <SaveTemplateDialog
        open={templateDialogOpen}
        projectName={project.name}
        defaultDescription={project.positioning}
        onClose={() => setTemplateDialogOpen(false)}
        onSave={(input) => void handleSaveTemplate(input)}
      />
      <MultiplyDialog
        open={multiplyOpen}
        onClose={() => setMultiplyOpen(false)}
        source={project}
      />
      <MediaDrawer
        open={coverDrawerOpen}
        onClose={() => setCoverDrawerOpen(false)}
        onPick={(asset) => update(project.id, { coverImage: asset.blobUrl })}
        projectId={project.id}
        country={project.country}
        assetType="cover-image"
      />
    </div>
  );
}

function SaveTemplateDialog({
  open,
  projectName,
  defaultDescription,
  onClose,
  onSave,
}: {
  open: boolean;
  projectName: string;
  defaultDescription: string;
  onClose: () => void;
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Save as template"
      description="Save a reusable starter for future products."
    >
      <div className="space-y-4">
        <FormField label="Template name" htmlFor="template-name">
          <Input
            id="template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField label="Description" htmlFor="template-description">
          <Textarea
            id="template-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </FormField>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-2 rounded-[var(--radius-control)] border border-border-soft bg-paper-2/40 p-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={includeStarterRoute}
              onChange={(event) => setIncludeStarterRoute(event.target.checked)}
              className="mt-1 accent-[var(--rc-forest)]"
            />
            <span>Include starter routes</span>
          </label>
          <label className="flex items-start gap-2 rounded-[var(--radius-control)] border border-border-soft bg-paper-2/40 p-3 text-sm text-ink-soft">
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
        <div className="rounded-[var(--radius-control)] border border-border-soft bg-paper-2/35 p-3 text-xs leading-5 text-ink-muted">
          Strips generated assets, image URLs, AI runs, activity, verification
          notes, publish review state, revisions, and project timestamps.
        </div>
      </div>
      <DialogActions>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name,
              description,
              includeStarterRoute,
              includeMappedCoords: includeStarterRoute && includeMappedCoords,
            })
          }
        >
          Save template
        </Button>
      </DialogActions>
    </Dialog>
  );
}
