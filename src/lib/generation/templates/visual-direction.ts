import type { PromptTemplate } from "../types";
import { list } from "../context";

export const visualDirectionTemplate: PromptTemplate = {
  id: "visual-direction",
  label: "Visual direction",
  group: "Visuals",
  description: "Art direction for the listing's visual identity.",
  build: (ctx) => `You are an art director for a boutique travel-itinerary brand.

Define the visual direction for a custom ${ctx.project.country || "country"} itinerary product. The brand voice is ${ctx.brand.voice}.

Context:
- Country: ${ctx.project.country || "(set the country)"}
- Travel styles: ${list(ctx.project.travelStyles.length ? ctx.project.travelStyles : ctx.config.travelStyles)}
- Audience: ${ctx.project.targetAudience || "general premium travelers"}

Produce:
1. A color palette (4-6 colors) that feels premium and editorial, fitting ${ctx.project.country || "the country"}.
2. Typography direction (heading + body).
3. Photography / illustration style notes.
4. Layout principles for thumbnails and PDF pages.
5. 5 visual motifs specific to ${ctx.project.country || "the country"} (avoid stereotypes and avoid mixing in other countries' icons).

Keep it usable as a brief for designers and image generators.`,
};
