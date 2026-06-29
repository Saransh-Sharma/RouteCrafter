import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { seedProjects } from "@/lib/seed-projects";
import { PDF_PRINT_PAYLOAD_KEY } from "@/components/workspace/pdf/pdf-print-payload";
import { POST } from "./route";

const pageMock = vi.hoisted(() => ({
  goto: vi.fn(),
  waitForSelector: vi.fn(),
  waitForFunction: vi.fn(),
  pdf: vi.fn(),
}));

const contextMock = vi.hoisted(() => ({
  addInitScript: vi.fn(),
  newPage: vi.fn(),
}));

const browserMock = vi.hoisted(() => ({
  newContext: vi.fn(),
  close: vi.fn(),
}));

const launchMock = vi.hoisted(() => vi.fn());

vi.mock("playwright", () => ({
  chromium: {
    launch: launchMock,
  },
}));

describe("POST /api/pdf/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    launchMock.mockResolvedValue(browserMock);
    browserMock.newContext.mockResolvedValue(contextMock);
    browserMock.close.mockResolvedValue(undefined);
    contextMock.addInitScript.mockResolvedValue(undefined);
    contextMock.newPage.mockResolvedValue(pageMock);
    pageMock.goto.mockResolvedValue(undefined);
    pageMock.waitForSelector.mockResolvedValue(undefined);
    pageMock.waitForFunction.mockResolvedValue(undefined);
    pageMock.pdf.mockResolvedValue(Buffer.from("%PDF-mocked"));
  });

  it("returns a PDF response and seeds the exact client project payload", async () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });
    itinerary.id = "current-itinerary";
    itinerary.title = "Unsaved client-side PDF title";
    project.itineraries = [itinerary];

    const response = await POST(
      new Request("https://routecrafter.test/api/pdf/export", {
        method: "POST",
        body: JSON.stringify({ project, itineraryId: itinerary.id }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(
      "japan-3-days-itinerary.pdf",
    );
    expect(new TextDecoder().decode(await response.arrayBuffer())).toContain(
      "%PDF",
    );
    expect(contextMock.addInitScript).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        key: PDF_PRINT_PAYLOAD_KEY,
        value: expect.stringContaining("Unsaved client-side PDF title"),
      }),
    );
  });

  it("rejects a missing selected itinerary", async () => {
    const project = structuredClone(seedProjects[0]);

    const response = await POST(
      new Request("https://routecrafter.test/api/pdf/export", {
        method: "POST",
        body: JSON.stringify({ project, itineraryId: "missing" }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Selected itinerary not found.",
    });
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("returns a clear error when Chromium cannot launch", async () => {
    const project = structuredClone(seedProjects[0]);
    const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });
    itinerary.id = "current-itinerary";
    project.itineraries = [itinerary];
    launchMock.mockRejectedValueOnce(
      new Error("Executable doesn't exist at /ms-playwright/chromium"),
    );

    const response = await POST(
      new Request("https://routecrafter.test/api/pdf/export", {
        method: "POST",
        body: JSON.stringify({ project, itineraryId: itinerary.id }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error:
        "Chromium could not start for PDF export. Install Playwright browser binaries in this runtime or configure a browserless renderer.",
    });
  });

  it("points Playwright at the hermetic Chromium install on Vercel", async () => {
    const previousVercel = process.env.VERCEL;
    const previousBrowsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
    process.env.VERCEL = "1";
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;

    try {
      const project = structuredClone(seedProjects[0]);
      const itinerary = buildItinerary(buildContext(project), {
        duration: "3 days",
      });
      itinerary.id = "current-itinerary";
      project.itineraries = [itinerary];

      const response = await POST(
        new Request("https://routecrafter.test/api/pdf/export", {
          method: "POST",
          body: JSON.stringify({ project, itineraryId: itinerary.id }),
        }),
      );

      expect(response.status).toBe(200);
      expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe("0");
    } finally {
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
      if (previousBrowsersPath === undefined)
        delete process.env.PLAYWRIGHT_BROWSERS_PATH;
      else process.env.PLAYWRIGHT_BROWSERS_PATH = previousBrowsersPath;
    }
  });
});
