import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PreviewCard } from "@/components/ui/PreviewCard";
import { mockProjects } from "@/lib/mock-data";

export default function ProjectsPage() {
  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Projects"
        title="All country projects"
        subtitle="Every itinerary product in your studio. Sample projects shown until local persistence lands in Phase 2."
        actions={
          <Link
            href="/projects/new"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-forest px-4 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep"
          >
            <Plus className="size-4" />
            New project
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {mockProjects.map((project) => (
          <PreviewCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
