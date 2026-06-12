import type { PromptTemplate } from "../types";
import { configBlock } from "../context";
import { VERIFICATION_FOOTER } from "../realism";

export const transportGuideTemplate: PromptTemplate = {
  id: "transport-guide",
  label: "Transport guide",
  group: "Guides",
  description: "Airport arrival, intercity, local transit, and passes.",
  build: (ctx) => `Write a transport guide for ${ctx.project.country || "this country"}, tailored to the trip below.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Cover:
- Airport arrival and getting to the first base.
- City-to-city movement (align with the transport preferences above).
- Local transit options and how to use them.
- Passes/cards worth considering and who they suit.
- Taxi/rideshare notes and rough cost levels (no exact fares).
- Walking intensity and tips for low-walking or mobility-limited travelers if relevant.

${VERIFICATION_FOOTER}`,
};
