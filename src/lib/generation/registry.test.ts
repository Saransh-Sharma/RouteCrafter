import { describe, expect, it } from "vitest";
import { seedProjects } from "../seed-projects";
import { buildContext } from "./context";
import { renderTemplate } from "./registry";

const NL = "NATURAL LANGUAGE RULES";
const ctx = buildContext(seedProjects[0]);

const proseTemplateIds = [
  "country-positioning",
  "expanded-itinerary",
  "listing-copy",
  "pdf-version",
  "spreadsheet-version",
  "buyer-requirements",
  "faq",
  "packing-list",
  "food-guide",
  "transport-guide",
] as const;

const visualTemplateIds = ["image-prompts", "visual-direction"] as const;

describe("natural-language guardrails in templates", () => {
  it.each(proseTemplateIds)("includes the rules in %s", (id) => {
    expect(renderTemplate(id, ctx)).toContain(NL);
  });

  it.each(visualTemplateIds)("excludes the rules from %s", (id) => {
    expect(renderTemplate(id, ctx)).not.toContain(NL);
  });
});
