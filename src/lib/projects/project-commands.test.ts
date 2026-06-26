import { describe, expect, it } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { seedProjects } from "@/lib/seed-projects";
import { projectSchema } from "@/lib/schemas";
import {
  createProjectCommand,
  duplicateEditionCommand,
  duplicateProjectCommand,
  importProjectCommand,
  patchItineraryCommand,
  removeDuplicatedEditionCommand,
  updateProjectCommand,
} from "./project-commands";

describe("project commands", () => {
  it("creates a normalized draft project with reset publish review", () => {
    const { project, activityDetail } = createProjectCommand(
      { name: "Italy Starter", country: "Italy" },
      0,
    );

    expect(projectSchema.parse(project)).toBeTruthy();
    expect(project.status).toBe("Draft");
    expect(project.productionPlan.review).toMatchObject({
      liveDataVerified: false,
      presentationReviewed: false,
      backupConfirmed: false,
    });
    expect(activityDetail).toBe('Created project "Italy Starter"');
  });

  it("marks ready projects in progress when readiness fields change", () => {
    const original = {
      ...structuredClone(seedProjects[0]),
      status: "Ready to sell" as const,
      productionPlan: {
        ...seedProjects[0].productionPlan,
        review: {
          liveDataVerified: true,
          presentationReviewed: true,
          backupConfirmed: true,
          confirmedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    };

    const updated = updateProjectCommand(original, (project) => ({
      ...project,
      country: "France",
    }));

    expect(updated.status).toBe("In progress");
    expect(updated.productionPlan.review).toMatchObject({
      liveDataVerified: false,
      presentationReviewed: false,
      backupConfirmed: false,
    });
  });

  it("patches one itinerary without needing store state", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), {
      duration: "7 days",
      travelerType: "Couple",
    });
    itinerary.updatedAt = "2026-01-01T00:00:00.000Z";
    const withItinerary = { ...project, itineraries: [itinerary] };

    const updated = patchItineraryCommand(withItinerary, itinerary.id, {
      pdfTheme: "sage",
    });

    expect(updated.itineraries[0].pdfTheme).toBe("sage");
    expect(updated.itineraries[0].updatedAt).not.toBe(itinerary.updatedAt);
  });

  it("duplicates projects and imported colliding ids with fresh ids", () => {
    const source = structuredClone(seedProjects[0]);
    const duplicated = duplicateProjectCommand(source);
    const imported = importProjectCommand(source, [source]);

    expect(duplicated.project.id).not.toBe(source.id);
    expect(duplicated.project.name).toContain("(Copy)");
    expect(imported.project.id).not.toBe(source.id);
    expect(imported.activityDetail).toBe(`Imported project "${source.name}"`);
  });

  it("duplicates and removes an edition with its cloned itinerary", () => {
    const project = structuredClone(seedProjects[0]);
    const source = {
      id: "edition-source",
      duration: "7 days" as const,
      travelerType: "Couple" as const,
      cities: ["Tokyo", "Kyoto"],
      route: [
        { id: "stop-tokyo", city: "Tokyo", nights: 3 },
        { id: "stop-kyoto", city: "Kyoto", nights: 4 },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const linked = buildItinerary(buildContext(project), {
      duration: source.duration,
      travelerType: source.travelerType,
    });
    project.productionPlan.editions = [{ ...source, itineraryId: linked.id }];
    project.itineraries = [linked];

    const duplicated = duplicateEditionCommand(project, source.id);
    expect(duplicated).toBeTruthy();
    expect(duplicated!.edition.sourceEditionId).toBe(source.id);
    expect(duplicated!.project.itineraries).toHaveLength(2);

    const removed = removeDuplicatedEditionCommand(
      duplicated!.project,
      duplicated!.edition.id,
    );
    expect(removed.ok).toBe(true);
    expect(removed.project?.productionPlan.editions).toHaveLength(
      project.productionPlan.editions.length,
    );
    expect(removed.project?.itineraries).toHaveLength(1);
  });
});
