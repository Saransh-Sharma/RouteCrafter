import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PDF_PRINT_PAYLOAD_KEY,
  createPdfPrintPayload,
  pdfFilename,
  selectedPrintItinerary,
} from "@/components/workspace/pdf/pdf-print-payload";
import { projectSchema } from "@/lib/schemas";
import { launchPdfChromium, type PdfChromiumBrowser } from "./chromium";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pdfExportRequestSchema = z.object({
  project: projectSchema,
  itineraryId: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = pdfExportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid PDF export payload." },
      { status: 400 },
    );
  }

  const payload = createPdfPrintPayload(
    parsed.data.project,
    parsed.data.itineraryId,
  );
  if (!selectedPrintItinerary(payload)) {
    return NextResponse.json(
      { error: "Selected itinerary not found." },
      { status: 404 },
    );
  }

  const origin = new URL(request.url).origin;
  const filename = pdfFilename(payload.project, payload.itineraryId);
  let browser: PdfChromiumBrowser | null = null;

  try {
    browser = await launchPdfChromium();
    const context = await browser.newContext({
      viewport: { width: 1240, height: 1754 },
    });
    await context.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      {
        key: PDF_PRINT_PAYLOAD_KEY,
        value: JSON.stringify(payload),
      },
    );

    const page = await context.newPage();
    await page.goto(`${origin}/pdf/print`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-pdf-print-ready="true"]', {
      timeout: 30_000,
    });
    await page.waitForFunction(
      async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        const images = Array.from(document.images);
        await Promise.all(
          images.map((image) => {
            if (image.complete && image.naturalWidth > 0) {
              return image.decode?.().catch(() => undefined);
            }
            return new Promise<void>((resolve, reject) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => reject(), { once: true });
            });
          }),
        );
        return true;
      },
      undefined,
      { timeout: 30_000 },
    );

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
      scale: 1,
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate the PDF.";
    const chromiumLaunchFailure =
      /chromium|browser|executable|playwright/i.test(message);
    return NextResponse.json(
      {
        error: chromiumLaunchFailure
          ? "Chromium could not start for PDF export. Install Playwright browser binaries in this runtime or configure a browserless renderer."
          : message,
      },
      { status: 500 },
    );
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
