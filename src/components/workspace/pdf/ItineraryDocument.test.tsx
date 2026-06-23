import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedProjects } from "@/lib/seed-projects";
import { buildContext, buildItinerary } from "@/lib/generation";
import { ItineraryDocument } from "./ItineraryDocument";
import {
  isEmbeddedImageSource,
  prepareDocumentForPdf,
} from "./pdf-assets";

describe("ItineraryDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("classifies external URLs as requiring PDF embed validation", () => {
    expect(isEmbeddedImageSource("data:image/jpeg;base64,abc")).toBe(true);
    expect(isEmbeddedImageSource("https://images.example.com/a.jpg")).toBe(
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

  it("blocks PDF preparation when a remote image is not canvas-safe", async () => {
    class RejectedCorsImage {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", RejectedCorsImage);

    const image = {
      complete: true,
      naturalWidth: 100,
      currentSrc: "https://images.example.com/cover.jpg",
      src: "https://images.example.com/cover.jpg",
      decode: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLImageElement;
    const root = {
      querySelectorAll: () => [image],
    } as unknown as HTMLElement;

    await expect(prepareDocumentForPdf(root)).rejects.toThrow(
      "Upload that image instead",
    );
  });
});
