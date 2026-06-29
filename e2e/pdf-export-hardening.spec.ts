import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { buildContext, buildItinerary } from "../src/lib/generation";
import { seedProjects } from "../src/lib/seed-projects";
import { PDF_PRINT_PAYLOAD_KEY } from "../src/components/workspace/pdf/pdf-print-payload";

const imageDataUri =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="#d9a066"/>
          <stop offset="1" stop-color="#49382b"/>
        </linearGradient>
      </defs>
      <rect width="1536" height="1024" fill="url(#g)"/>
      <circle cx="1140" cy="300" r="170" fill="#f8ead7" opacity=".38"/>
      <path d="M0 760c210-130 420-170 650-85s420 40 605-80 250-70 281-25v454H0z" fill="#221912" opacity=".55"/>
    </svg>`,
  );

function stressProject() {
  const project = structuredClone(seedProjects[0]);
  const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });
  const longText = Array.from(
    { length: 130 },
    (_, index) =>
      `Segment ${index + 1} keeps enough real itinerary copy to wrap over multiple lines without becoming a single unbreakable word.`,
  ).join(" ");

  itinerary.id = "pdf-hardening-stress";
  itinerary.coverImage = "";
  itinerary.overview = longText;
  itinerary.foodGuide = longText;
  itinerary.transportGuide = longText;
  itinerary.days[0] = {
    ...itinerary.days[0],
    image: imageDataUri,
    morning: longText,
    lunch: longText,
    transportNotes: longText,
    bookingNotes: longText,
    whyThisWorks: longText,
  };
  project.itineraries = [itinerary];
  return { project, itinerary };
}

test("print route composes stress PDF pages without DOM overflow", async ({
  page,
}) => {
  const { project, itinerary } = stressProject();
  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, JSON.stringify(payload));
    },
    {
      key: PDF_PRINT_PAYLOAD_KEY,
      payload: {
        project,
        itineraryId: itinerary.id,
        generatedAt: "2026-06-29T00:00:00.000Z",
      },
    },
  );

  await page.goto("/pdf/print");
  await expect(page.locator('[data-pdf-print-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((image) =>
        image.complete ? image.decode().catch(() => undefined) : undefined,
      ),
    );
  });

  const metrics = await page.locator(".rc-print-page").evaluateAll((pages) =>
    pages.map((pageElement, index) => {
      const pageRect = pageElement.getBoundingClientRect();
      const overflowingChildren = Array.from(
        pageElement.querySelectorAll<HTMLElement>("*"),
      )
        .filter((child) => {
          const rect = child.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          return (
            rect.bottom > pageRect.bottom + 1.5 ||
            rect.right > pageRect.right + 1.5 ||
            rect.left < pageRect.left - 1.5 ||
            rect.top < pageRect.top - 1.5
          );
        })
        .map((child) => child.className.toString() || child.tagName);
      return {
        index,
        className: pageElement.className,
        scrollOverflow:
          pageElement.scrollHeight > pageElement.clientHeight + 1 ||
          pageElement.scrollWidth > pageElement.clientWidth + 1,
        overflowingChildren,
      };
    }),
  );

  expect(metrics.length).toBeGreaterThan(10);
  expect(metrics.filter((metric) => metric.scrollOverflow)).toEqual([]);
  expect(
    metrics.filter((metric) => metric.overflowingChildren.length > 0),
  ).toEqual([]);

  const rowDeltas = await page.locator(".rc-day-row:not(.is-continuation)").evaluateAll(
    (rows) =>
      rows.map((row) => {
        const label = row.querySelector(".rc-day-row-label");
        const body = row.querySelector(".rc-day-row-body");
        if (!label || !body) return 0;
        return Math.abs(
          label.getBoundingClientRect().top - body.getBoundingClientRect().top,
        );
      }),
  );
  expect(Math.max(...rowDeltas)).toBeLessThanOrEqual(4);
});

test("server PDF export returns a native PDF for the stress payload", async ({
  request,
}, testInfo) => {
  const { project, itinerary } = stressProject();
  const response = await request.post("/api/pdf/export", {
    data: { project, itineraryId: itinerary.id },
  });
  const pdf = await response.body();

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await writeFile(testInfo.outputPath("stress-export.pdf"), pdf);
});
