import type { ItineraryOutput, Project } from "@/lib/types";
import { itineraryToMarkdown } from "../itinerary/export-itinerary";
import { listingToMarkdown } from "../listing/export-listing";
import { exportImagePromptsMarkdown } from "../image-prompts/export-image-prompts";

/** True when the project has any exportable generated content. */
export function hasAnyContent(project: Project): boolean {
  return Boolean(
    project.itineraries.length ||
      project.listing ||
      project.imagePrompts.length,
  );
}

/** A single Markdown document bundling every artifact present on the project. */
export function buildAiUsageAppendix(project: Project): string {
  const runs = project.aiRuns ?? [];
  if (!runs.length) return "";
  const rows = runs.map((run) => {
    const usage = [
      run.usage?.inputTokens ? `${run.usage.inputTokens} input tokens` : "",
      run.usage?.outputTokens ? `${run.usage.outputTokens} output tokens` : "",
      run.usage?.images ? `${run.usage.images} image` : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `- ${run.label} — ${run.provider} / ${run.model} (${new Date(
      run.appliedAt,
    ).toLocaleString()}${usage ? `; ${usage}` : ""})`;
  });
  return [
    "## AI Usage Appendix",
    "",
    "The following accepted artifacts used the user's configured AI provider account. API keys and prompt payloads are not included.",
    "",
    ...rows,
  ].join("\n");
}

export function buildMarkdownBundle(
  project: Project,
  options: { includeAiUsage?: boolean } = {},
): string {
  const parts: string[] = [];
  parts.push(`# ${project.name}`);
  const meta = [
    project.country && `Country: ${project.country}`,
    project.positioning && `Positioning: ${project.positioning}`,
    project.targetAudience && `Audience: ${project.targetAudience}`,
    `Status: ${project.status}`,
  ].filter(Boolean);
  parts.push(meta.join("\n"));

  for (const itinerary of project.itineraries) {
    parts.push(itineraryToMarkdown(itinerary, project));
  }
  if (project.listing) {
    parts.push(listingToMarkdown(project.listing, project));
  }
  if (project.imagePrompts.length) {
    parts.push(exportImagePromptsMarkdown(project));
  }
  if (options.includeAiUsage) {
    const appendix = buildAiUsageAppendix(project);
    if (appendix) parts.push(appendix);
  }

  return parts.join("\n\n---\n\n");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** A single itinerary -> spreadsheet-friendly CSV (one row per day). */
export function itineraryToCsv(itinerary: ItineraryOutput): string {
  const header = [
    "Day",
    "Title",
    "Base",
    "Morning",
    "Lunch",
    "Afternoon",
    "Evening",
    "Dinner",
    "Transport",
    "Booking",
    "Pace",
    "Notes",
    "Backup",
  ];
  const rows = itinerary.days.map((d) =>
    [
      String(d.day),
      d.title,
      d.base,
      d.morning,
      d.lunch,
      d.afternoon,
      d.evening,
      d.dinner,
      d.transportNotes,
      d.bookingNotes,
      d.pace ?? "",
      d.whyThisWorks,
      d.rainyDayAlternative || d.lowEnergyAlternative,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\n");
}

/** Generic text download. */
export function downloadText(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function projectSlug(project: Project): string {
  return (
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "routecrafter-project"
  );
}
