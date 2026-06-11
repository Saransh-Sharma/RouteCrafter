import type { ItineraryMatrix, Project } from "@/lib/types";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Matrix -> CSV (one row per variation). */
export function matrixToCsv(matrix: ItineraryMatrix): string {
  const header = ["Duration", "Traveler type", "Variation", "Route spine"];
  const rows = matrix.cells.flatMap((cell) =>
    cell.variations.map((v) =>
      [cell.duration, cell.travelerType, v.label, v.spine].map(csvCell).join(","),
    ),
  );
  return [header.map(csvCell).join(","), ...rows].join("\n");
}

/** Matrix -> Markdown, grouped by duration. */
export function matrixToMarkdown(matrix: ItineraryMatrix, project: Project): string {
  const byDuration = new Map<string, typeof matrix.cells>();
  for (const cell of matrix.cells) {
    const list = byDuration.get(cell.duration) ?? [];
    list.push(cell);
    byDuration.set(cell.duration, list);
  }

  const sections: string[] = [`# ${project.country || "Country"} - Itinerary Matrix\n`];
  for (const [duration, cells] of byDuration) {
    sections.push(`## ${duration}`);
    for (const cell of cells) {
      sections.push(`### ${cell.travelerType}`);
      for (const v of cell.variations) {
        sections.push(`- **${v.label}:** ${v.spine}`);
      }
    }
  }
  return sections.join("\n\n");
}

function download(filename: string, content: string, mime: string) {
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

export function downloadMatrixCsv(matrix: ItineraryMatrix, project: Project) {
  const slug = (project.country || "project").toLowerCase();
  download(`${slug}-itinerary-matrix.csv`, matrixToCsv(matrix), "text/csv");
}

export function downloadMatrixMarkdown(matrix: ItineraryMatrix, project: Project) {
  const slug = (project.country || "project").toLowerCase();
  download(
    `${slug}-itinerary-matrix.md`,
    matrixToMarkdown(matrix, project),
    "text/markdown",
  );
}
