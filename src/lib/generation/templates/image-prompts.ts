import type { PromptTemplate, GenerationContext } from "../types";
import { configBlock, durationLabel } from "../context";
import {
  type ImagePromptKind,
  type PortfolioImagePrompt,
} from "../../schemas";

const SHARED_STYLE =
  "Premium editorial travel-studio aesthetic. Warm ivory paper background, sage and forest green, terracotta, and muted gold accents. Elegant serif headlines with a clean sans body. Soft shadows, rounded cards, generous whitespace.";

const SHARED_NEGATIVE =
  "No clutter, no neon, no generic travel-agency look, no fake stock-photo faces, no distorted or misspelled text, no tiny unreadable labels, no watermark, no busy collage.";

export const IMAGE_PROMPT_KINDS: ImagePromptKind[] = [
  "hero",
  "what-youll-get",
  "sample-itinerary",
  "beyond-the-brochure",
  "built-around-style",
];

/** Build a single structured portfolio image prompt for a given slot. */
export function buildImagePrompt(
  kind: ImagePromptKind,
  ctx: GenerationContext,
): PortfolioImagePrompt {
  const country = ctx.project.country || "the country";
  const base = {
    id: crypto.randomUUID(),
    kind,
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
    countryAccuracyNotes: `Depict recognizable, accurate ${country} scenery and motifs. Do not mix in landmarks or symbols from other countries. Keep architecture, signage, and landscape true to ${country}.`,
    readabilityNotes:
      "All overlay text must be crisp and legible at thumbnail size. Use short lines, high contrast, and correct spelling. Headline first, supporting line smaller.",
    image: "",
    isFinal: false,
  };

  switch (kind) {
    case "hero":
      return {
        ...base,
        title: "Premium Hero Thumbnail",
        goal: `Primary marketplace image for the ${country} listing. Must stop the scroll and signal a premium, fully custom service.`,
        canvas: "Square 2000x2000 px (also export a 1280x769 cover variant).",
        layout:
          "Bold title in the upper third; an iconic country hero scene behind/below; a PDF + spreadsheet mockup in the lower third; small deliverable badges along the bottom edge.",
        visualElements: `Iconic ${country} scene; premium traveler/planner mood; a PDF guide and spreadsheet mockup; optional badges: PDF, Spreadsheet, Packing List, Local Tips.`,
        textOverlay: `Custom ${country} Itinerary\n3, 5, 7 & 14-Day Travel Plans`,
      };
    case "what-youll-get":
      return {
        ...base,
        title: "What You'll Get",
        goal: "Communicate the full value stack of deliverables at a glance.",
        canvas: "Square 2000x2000 px.",
        layout:
          "Title at top; a tidy grid of labeled cards/icons for each deliverable; calm spacing.",
        visualElements:
          "Day-by-day itinerary card; clickable spreadsheet; PDF guide; packing list; food/cafe recommendations; transport guidance; budget notes; booking tips.",
        textOverlay:
          "What You'll Get\nPersonalized itinerary, packing list, food picks, transport tips & local insights.",
      };
    case "sample-itinerary":
      return {
        ...base,
        title: "Sample Custom Itinerary",
        goal: "Show a believable sample so buyers understand the structure and quality.",
        canvas: "Square 2000x2000 px.",
        layout:
          "Title at top; three day-columns or stacked day cards; each day split into Morning / Afternoon / Evening with small icons.",
        visualElements: `A realistic ${country} sample: Day 1 Arrival & Orientation; Day 2 Culture & History; Day 3 Food, Markets & Local Life. Icons for food, transit, landmarks, rest, and markets. Include a small "For demonstration purposes only" note.`,
        textOverlay:
          "Sample Custom Travel Itinerary\nFor demonstration purposes only.",
      };
    case "beyond-the-brochure":
      return {
        ...base,
        title: "Designed Beyond the Brochure",
        goal: "Show the thoughtful method behind every itinerary (anti copy-paste).",
        canvas: "Square 2000x2000 px.",
        layout:
          "Title at top; a grid of method cards, each with a small icon and short label.",
        visualElements:
          "Method cards: Your travel style; What matters to you; Human-paced days; Local-first choices; Food & culture; Built-in flexibility; Backup options.",
        textOverlay:
          "Designed Beyond the Brochure\nEvery itinerary is custom. Nothing is copy-paste.",
      };
    case "built-around-style":
    default:
      return {
        ...base,
        title: "Built Around Your Travel Style",
        goal: "Show the product adapts to solo, couple, family, and group travelers.",
        canvas: "Square 2000x2000 px.",
        layout:
          "Title at top; four traveler cards in a 2x2 grid; a thin strip of extra-inclusions along the bottom.",
        visualElements:
          "Traveler cards: Solo (safe, flexible, confidence-building); Couple (romantic, scenic, memorable); Family (kid-friendly, practical, low-stress); Group (balanced, coordinated, easy to share). Bottom strip: packing list, local etiquette, food guide, transport pass guidance, rainy-day alternatives, booking checklist.",
        textOverlay:
          "Built Around Your Travel Style\nSolo · Couple · Family · Group",
      };
  }
}

/** Build all five structured portfolio image prompts. */
export function buildImagePrompts(
  ctx: GenerationContext,
): PortfolioImagePrompt[] {
  return IMAGE_PROMPT_KINDS.map((kind) => buildImagePrompt(kind, ctx));
}

/** Render a single image prompt as a copy-paste block. */
export function imagePromptToText(p: PortfolioImagePrompt): string {
  return `### Portfolio Image: ${p.title}

Goal: ${p.goal}
Canvas: ${p.canvas}
Layout: ${p.layout}
Visual Elements: ${p.visualElements}
Text Overlay:
${p.textOverlay}
Style: ${p.style}
Negative Prompt: ${p.negativePrompt}
Country Accuracy Notes: ${p.countryAccuracyNotes}
Readability Notes: ${p.readabilityNotes}`;
}

/** PromptTemplate variant (copy-paste prompt for an image/LLM tool). */
export const imagePromptsTemplate: PromptTemplate = {
  id: "image-prompts",
  label: "Five portfolio image prompts",
  group: "Visuals",
  description:
    "Generates the five listing image prompts (hero, value, sample, method, styles).",
  build: (ctx) => {
    const prompts = buildImagePrompts(ctx)
      .map((p, i) => `${i + 1}. ${imagePromptToText(p)}`)
      .join("\n\n");
    return `Use these five portfolio image prompts for the ${ctx.project.country || "country"} listing. Paste each into your image tool (Midjourney, DALL-E, etc.) one at a time, or refine with an LLM first.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Target durations to feature: ${durationLabel(ctx)} (and 3, 5, 7 & 14-day variants).

${prompts}`;
  },
};
