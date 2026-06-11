/**
 * Generation engine (Phase 4+).
 *
 * Pure, UI-free prompt-template engine. Mode 1 (copy-paste prompts) only; a
 * Phase 12 `generateWithModel(ctx)` can wrap the same `GenerationContext`.
 */

export type {
  GenerationContext,
  PromptTemplate,
  TemplateGroup,
} from "./types";
export { buildContext } from "./context";
export {
  templates,
  templateRegistry,
  renderTemplate,
  templatesByGroup,
} from "./registry";
export {
  buildImagePrompt,
  buildImagePrompts,
  imagePromptToText,
  IMAGE_PROMPT_KINDS,
} from "./templates/image-prompts";
export { buildMatrix } from "./matrix";
export { buildItinerary, parseDays } from "./itinerary";
export type { BuildItineraryOptions } from "./itinerary";
export { buildListing } from "./listing";
