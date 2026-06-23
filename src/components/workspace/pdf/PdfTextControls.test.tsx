import * as React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { seedProjects } from "@/lib/seed-projects";
import { useProjectsStore } from "@/lib/store/projects-store";
import { ItineraryDocument } from "./ItineraryDocument";
import { PdfTextControls } from "./PdfTextControls";

describe("PdfTextControls", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "false");
    const project = structuredClone(seedProjects[0]);
    const itinerary = {
      ...buildItinerary(buildContext(project), { duration: "3 days" }),
      id: "pdf-sidebar-itinerary",
      title: "Original PDF title",
      subtitle: "Original PDF subtitle",
      overview: "Original trip overview",
      customBlocks: [],
    };
    useProjectsStore.setState({
      projects: [{ ...project, itineraries: [itinerary] }],
      initialized: true,
      hasHydrated: true,
      persistenceError: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("updates itinerary fields and the PDF preview from sidebar textboxes", () => {
    render(<PdfHarness />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Sidebar edited PDF title" },
    });
    fireEvent.change(screen.getByLabelText("Subtitle"), {
      target: { value: "Sidebar edited PDF subtitle" },
    });
    fireEvent.change(screen.getByLabelText("Trip overview"), {
      target: { value: "Sidebar edited trip overview" },
    });

    expect(screen.getByText("Sidebar edited PDF title")).toBeTruthy();
    expect(screen.getAllByText("Sidebar edited PDF subtitle").length).toBeGreaterThan(
      1,
    );
    expect(
      screen.getAllByText("Sidebar edited trip overview").length,
    ).toBeGreaterThan(1);
    expect(
      useProjectsStore.getState().projects[0].itineraries[0].title,
    ).toBe("Sidebar edited PDF title");
  });

  it("adds, edits, and removes custom PDF text blocks from the sidebar", () => {
    render(<PdfHarness />);

    fireEvent.click(
      screen.getByRole("button", { name: "Custom PDF sections" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add custom PDF text" }));

    const customSection = screen
      .getByText("Custom text block")
      .closest(".space-y-3.rounded-xl") as HTMLElement | null;
    if (!customSection) throw new Error("Custom text block controls not found");

    fireEvent.change(within(customSection!).getByLabelText("Text"), {
      target: { value: "Sidebar-only callout copy" },
    });
    fireEvent.change(within(customSection!).getByLabelText("Style"), {
      target: { value: "callout" },
    });

    expect(screen.getAllByText("Sidebar-only callout copy").length).toBeGreaterThan(
      1,
    );
    expect(
      useProjectsStore.getState().projects[0].itineraries[0].customBlocks[0],
    ).toMatchObject({
      anchor: "overview",
      type: "text",
      variant: "callout",
      text: "Sidebar-only callout copy",
    });

    fireEvent.click(
      within(customSection!).getByRole("button", {
        name: "Delete custom text",
      }),
    );

    expect(screen.queryByText("Sidebar-only callout copy")).toBeNull();
    expect(
      useProjectsStore.getState().projects[0].itineraries[0].customBlocks,
    ).toEqual([]);
  });
});

function PdfHarness() {
  const project = useProjectsStore((state) => state.projects[0]);
  const itinerary = project.itineraries[0];

  return (
    <div>
      <PdfTextControls project={project} itinerary={itinerary} />
      <ItineraryDocument project={project} itinerary={itinerary} />
    </div>
  );
}
