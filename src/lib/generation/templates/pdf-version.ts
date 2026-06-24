import type { PromptTemplate } from "../types";
import { configBlock, durationLabel } from "../context";
import { REALISM_RULES, VERIFICATION_FOOTER } from "../realism";
import { NATURAL_LANGUAGE_RULES } from "../language";

export const pdfVersionTemplate: PromptTemplate = {
  id: "pdf-version",
  label: "PDF-style itinerary",
  group: "Itinerary",
  description: "Itinerary formatted as premium, page-by-page PDF content.",
  build: (ctx) => `Format a ${durationLabel(ctx)} ${ctx.project.country || "country"} itinerary as a premium, page-by-page PDF document.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Output content organized into these pages, each with a clear heading:
1. Cover (country, duration, traveler type, travel style, "Custom Travel Itinerary")
2. Trip overview
3. Route summary
4. Day-by-day itinerary (timeline-style day cards: morning/afternoon/evening)
5. Food & cafe guide
6. Transport guide
7. Accommodation guidance
8. Packing list (checklist format)
9. Booking checklist (checklist format)
10. Etiquette & safety
11. Personalization notes
12. Final checklist

Keep it elegant and printable (A4). Use short paragraphs and checklists. End with this disclaimer line: "${VERIFICATION_FOOTER}"

${NATURAL_LANGUAGE_RULES}

${REALISM_RULES}`,
};
