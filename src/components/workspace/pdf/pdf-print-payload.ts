import { z } from "zod";
import { projectSchema, type Project } from "@/lib/schemas";

export const PDF_PRINT_PAYLOAD_KEY = "routecrafter:pdf-print-payload:v1";

export const pdfPrintPayloadSchema = z.object({
  project: projectSchema,
  itineraryId: z.string().min(1),
  generatedAt: z.string(),
});

export type PdfPrintPayload = z.infer<typeof pdfPrintPayloadSchema>;

export function createPdfPrintPayload(
  project: Project,
  itineraryId: string,
): PdfPrintPayload {
  return {
    project,
    itineraryId,
    generatedAt: new Date().toISOString(),
  };
}

export function selectedPrintItinerary(payload: PdfPrintPayload) {
  return (
    payload.project.itineraries.find(
      (itinerary) => itinerary.id === payload.itineraryId,
    ) ?? null
  );
}

export function pdfFilename(project: Project, itineraryId: string): string {
  const itinerary = project.itineraries.find((item) => item.id === itineraryId);
  const country = project.country || itinerary?.country || "project";
  const duration = itinerary?.duration || "itinerary";
  const slug = country
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const compactDuration = duration.replace(/\s+/g, "");
  return `${slug || "project"}-${compactDuration}-itinerary.pdf`;
}

