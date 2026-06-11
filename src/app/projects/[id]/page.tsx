import Link from "next/link";
import { ArrowLeft, Copy, MapPin } from "lucide-react";
import { getMockProject, workspaceModules } from "@/lib/mock-data";
import { Badge } from "@/components/ui/Badge";
import { ExportButton } from "@/components/ui/ExportButton";
import { Card, CardContent } from "@/components/ui/Card";
import { WorkspaceTabs } from "@/components/workspace/WorkspaceTabs";

const statusTone = {
  Draft: "neutral",
  "In progress": "gold",
  "Ready to sell": "sage",
} as const;

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getMockProject(id);

  if (!project) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="space-y-4 p-10 text-center">
            <h2 className="text-2xl font-semibold text-ink">
              Project not found
            </h2>
            <p className="text-sm text-ink-soft">
              This project isn&apos;t in the current sample set. Local persistence
              for real projects arrives in Phase 2.
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

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      {/* Project header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-terracotta">
            <MapPin className="size-4" />
            {project.country}
          </div>
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={statusTone[project.status]}>{project.status}</Badge>
            <Badge tone="neutral">
              {project.durations.length} durations supported
            </Badge>
            <Badge tone="neutral">
              {project.travelerTypes.length} traveler types
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong bg-paper/60 px-4 text-sm font-medium text-ink-soft transition-colors hover:border-forest/40 hover:text-ink"
          >
            <Copy className="size-4" />
            Duplicate
          </button>
          <ExportButton />
        </div>
      </div>

      <WorkspaceTabs project={project} modules={workspaceModules} />
    </div>
  );
}
