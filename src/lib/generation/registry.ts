import type { GenerationContext, PromptTemplate } from "./types";
import { countryPositioningTemplate } from "./templates/country-positioning";
import { visualDirectionTemplate } from "./templates/visual-direction";
import { imagePromptsTemplate } from "./templates/image-prompts";
import { itineraryMatrixTemplate } from "./templates/itinerary-matrix";
import { expandedItineraryTemplate } from "./templates/expanded-itinerary";
import { listingCopyTemplate } from "./templates/listing-copy";
import { pdfVersionTemplate } from "./templates/pdf-version";
import { spreadsheetVersionTemplate } from "./templates/spreadsheet-version";
import { packingListTemplate } from "./templates/packing-list";
import { foodGuideTemplate } from "./templates/food-guide";
import { transportGuideTemplate } from "./templates/transport-guide";
import { buyerRequirementsTemplate } from "./templates/buyer-requirements";
import { faqTemplate } from "./templates/faq";

export const templates: PromptTemplate[] = [
  countryPositioningTemplate,
  visualDirectionTemplate,
  imagePromptsTemplate,
  itineraryMatrixTemplate,
  expandedItineraryTemplate,
  pdfVersionTemplate,
  spreadsheetVersionTemplate,
  listingCopyTemplate,
  buyerRequirementsTemplate,
  faqTemplate,
  packingListTemplate,
  foodGuideTemplate,
  transportGuideTemplate,
];

export const templateRegistry: Record<string, PromptTemplate> =
  Object.fromEntries(templates.map((t) => [t.id, t]));

/** Render a template by id against a context. Returns "" for unknown ids. */
export function renderTemplate(id: string, ctx: GenerationContext): string {
  return templateRegistry[id]?.build(ctx) ?? "";
}

/** Templates grouped by their `group` for sectioned UI. */
export function templatesByGroup(): Record<string, PromptTemplate[]> {
  return templates.reduce<Record<string, PromptTemplate[]>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {});
}
