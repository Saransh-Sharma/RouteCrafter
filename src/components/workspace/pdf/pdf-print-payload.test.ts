import { describe, expect, it } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { seedProjects } from "@/lib/seed-projects";
import {
  createPdfPrintPayload,
  pdfFilename,
  selectedPrintItinerary,
} from "./pdf-print-payload";

describe("pdf print payload", () => {
  it("selects the requested itinerary from the current project payload", () => {
    const project = structuredClone(seedProjects[0]);
    const context = buildContext(project);
    const first = buildItinerary(context, { duration: "3 days" });
    const second = buildItinerary(context, { duration: "7 days" });
    first.id = "short";
    second.id = "long";
    second.title = "Current unsaved PDF title";
    project.itineraries = [first, second];

    const payload = createPdfPrintPayload(project, "long");

    expect(selectedPrintItinerary(payload)?.title).toBe(
      "Current unsaved PDF title",
    );
  });

  it("builds a stable PDF filename from project country and itinerary duration", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), { duration: "10 days" });
    itinerary.id = "itinerary";
    project.country = "New Zealand";
    project.itineraries = [itinerary];

    expect(pdfFilename(project, "itinerary")).toBe(
      "new-zealand-10days-itinerary.pdf",
    );
  });
});

