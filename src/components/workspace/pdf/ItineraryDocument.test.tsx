import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { seedProjects } from "@/lib/seed-projects";
import { buildContext, buildItinerary } from "@/lib/generation";
import { ItineraryDocument } from "./ItineraryDocument";

describe("ItineraryDocument", () => {
  it("marks photo covers and does not force cross-origin image loading", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = {
      ...buildItinerary(buildContext(project), { duration: "3 days" }),
      coverImage: "https://example.com/cover.jpg",
    };
    const { container } = render(
      <ItineraryDocument itinerary={itinerary} project={project} />,
    );

    expect(
      container.querySelector(".rc-doc-cover")?.classList.contains("has-photo"),
    ).toBe(true);
    expect(screen.getByAltText("Japan cover").hasAttribute("crossorigin")).toBe(
      false,
    );
  });

  it("renders route-map custom blocks in the PDF document", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = {
      ...buildItinerary(buildContext(project), { duration: "3 days" }),
      customBlocks: [
        {
          id: "route-map",
          anchor: "overview",
          order: 0,
          type: "route-map" as const,
          variant: "",
          text: "Tokyo to Kyoto route map",
          image: "",
        },
      ],
    };

    render(<ItineraryDocument itinerary={itinerary} project={project} />);

    expect(screen.getByText("Route map")).toBeTruthy();
    expect(screen.getByText("Tokyo to Kyoto route map")).toBeTruthy();
  });

  it("renders explicit document page classes for PDF pagination", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = {
      ...buildItinerary(buildContext(project), { duration: "3 days" }),
      foodGuide: "Eat near neighborhood stations.",
    };

    const { container } = render(
      <ItineraryDocument itinerary={itinerary} project={project} />,
    );

    expect(container.querySelector(".rc-doc-overview-page")).toBeTruthy();
    expect(container.querySelectorAll(".rc-doc-day-page").length).toBeGreaterThanOrEqual(
      itinerary.days.length,
    );
    expect(container.querySelector(".rc-doc-day-notes-page")).toBeTruthy();
    expect(container.querySelector(".rc-doc-guides-page")).toBeTruthy();
    expect(container.querySelector(".rc-doc-closing-page")).toBeTruthy();
  });

  it("renders a Local details page only for days that have details", () => {
    const project = structuredClone(seedProjects[0]);
    const base = buildItinerary(buildContext(project), { duration: "3 days" });
    const itinerary = {
      ...base,
      days: base.days.map((day, index) =>
        index === 0
          ? {
              ...day,
              base: "Shibuya",
              details: {
                base: "Shibuya",
                restaurants: [
                  {
                    name: "Fuglen Tokyo",
                    area: "Tomigaya",
                    category: "cafe",
                    whyItFits: "Slow morning coffee near the park.",
                    priceBand: "$$",
                    source: "https://example.com/fuglen",
                    caveat: "Verify hours before visiting.",
                  },
                ],
                stays: [],
                activities: [],
                shopping: [],
                trivia: [{ text: "Shibuya Crossing dates to the 1970s.", source: "" }],
                generatedAt: "2026-06-25T00:00:00.000Z",
              },
            }
          : day,
      ),
    };

    const { container } = render(
      <ItineraryDocument itinerary={itinerary} project={project} />,
    );

    // Exactly one day carries details → exactly one details page.
    expect(
      container.querySelectorAll(".rc-doc-day-details-page"),
    ).toHaveLength(1);
    expect(screen.getByText("Fuglen Tokyo")).toBeTruthy();
    expect(screen.getByText("Source: https://example.com/fuglen")).toBeTruthy();
    expect(screen.getByText("Verify hours before visiting.")).toBeTruthy();
  });

  it("omits all Local details pages when no day has details", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });

    const { container } = render(
      <ItineraryDocument itinerary={itinerary} project={project} />,
    );

    expect(container.querySelectorAll(".rc-doc-day-details-page")).toHaveLength(
      0,
    );
  });

  it("uses one canonical document layout without export-only classes", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });

    const { container } = render(
      <ItineraryDocument itinerary={itinerary} project={project} />,
    );

    expect(container.querySelector(".rc-doc")?.classList).not.toContain(
      "rc-doc-export",
    );
    expect(container.querySelector(".rc-print-page")).toBeTruthy();
    expect(
      container.querySelector(".rc-print-page")?.classList.contains(
        "rc-doc-cover",
      ),
    ).toBe(true);
  });

  it("renders why-this-works as a full-width good-to-know conclusion", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });
    itinerary.days[0].transportNotes = "Use taxi on arrival.";
    itinerary.days[0].bookingNotes = "Pre-book timed entry.";
    itinerary.days[0].whyThisWorks = "This keeps the fixed priority early.";

    render(<ItineraryDocument itinerary={itinerary} project={project} />);

    const conclusion = screen
      .getByText("This keeps the fixed priority early.")
      .closest(".rc-day-note");

    expect(conclusion?.classList.contains("rc-day-note-conclusion")).toBe(
      true,
    );
  });

  it("keeps day images as regular images in preview mode", () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });
    itinerary.days[0].image = "https://images.example.com/day-one.jpg";

    render(<ItineraryDocument itinerary={itinerary} project={project} />);

    const image = screen.getByAltText("Day 1");
    const frame = image.closest(".rc-doc-day-img-frame");

    expect(image.getAttribute("src")).toBe(
      "https://images.example.com/day-one.jpg",
    );
    expect(frame?.getAttribute("style") ?? "").not.toContain(
      "background-image",
    );
  });

});
