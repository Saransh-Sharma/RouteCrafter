"use client";

import * as React from "react";
import { PencilLine } from "lucide-react";
import type { Project } from "@/lib/types";
import { PreviewCard } from "@/components/ui/PreviewCard";

const RECENT_LIMIT = 3;

/**
 * A strip of the most recently touched unfinished projects so authors can jump
 * straight back into work in progress.
 */
export function RecentDrafts({ projects }: { projects: Project[] }) {
  const drafts = React.useMemo(
    () =>
      [...projects]
        .filter((project) => project.status !== "Ready to sell")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, RECENT_LIMIT),
    [projects],
  );

  if (drafts.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
        <PencilLine className="size-5 text-gold" />
        Recent drafts
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {drafts.map((project) => (
          <PreviewCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
