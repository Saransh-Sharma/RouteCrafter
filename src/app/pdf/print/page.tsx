"use client";

import * as React from "react";
import { ItineraryDocument } from "@/components/workspace/pdf/ItineraryDocument";
import {
  PDF_PRINT_PAYLOAD_KEY,
  pdfPrintPayloadSchema,
  selectedPrintItinerary,
  type PdfPrintPayload,
} from "@/components/workspace/pdf/pdf-print-payload";

function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export default function PdfPrintPage() {
  const [payload, setPayload] = React.useState<PdfPrintPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const raw = window.localStorage.getItem(PDF_PRINT_PAYLOAD_KEY);
      if (!raw) {
        setError(
          "No PDF print payload found. Return to the PDF builder and try again.",
        );
        setLoaded(true);
        return;
      }

      try {
        const parsed = pdfPrintPayloadSchema.parse(JSON.parse(raw));
        setPayload(parsed);
      } catch {
        setError(
          "The PDF print payload is invalid. Return to the PDF builder and try again.",
        );
      } finally {
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const itinerary = payload ? selectedPrintItinerary(payload) : null;

  React.useEffect(() => {
    if (!payload || !itinerary) return;
    let cancelled = false;

    async function markReady() {
      if (document.fonts?.ready) await document.fonts.ready;
      await nextFrame();
      if (cancelled) return;
      setReady(true);
      if (new URLSearchParams(window.location.search).get("autoprint") === "1") {
        await nextFrame();
        window.print();
      }
    }

    void markReady();
    return () => {
      cancelled = true;
    };
  }, [payload, itinerary]);

  if (loaded && (error || (payload && !itinerary))) {
    return (
      <main className="min-h-[100dvh] bg-paper p-8 text-ink">
        <p className="max-w-md text-sm text-ink-soft">
          {error ?? "The selected itinerary could not be found in this print payload."}
        </p>
      </main>
    );
  }

  if (!loaded || !payload || !itinerary) {
    return (
      <main className="min-h-[100dvh] bg-paper p-8 text-sm text-ink-soft">
        Preparing PDF...
      </main>
    );
  }

  return (
    <main
      className="min-h-[100dvh] bg-white"
      data-pdf-print-ready={ready ? "true" : "false"}
    >
      <ItineraryDocument itinerary={itinerary} project={payload.project} />
    </main>
  );
}
