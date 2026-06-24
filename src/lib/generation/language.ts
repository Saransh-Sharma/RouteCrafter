/**
 * Shared natural-language guardrails injected into prose-producing prompts so
 * generated copy reads like a working travel planner, not generic AI marketing.
 * Positive-first by design (negated "don't" lists backfire); the avoid-list is a
 * soft "rewrite these" cue, not a hard ban.
 */
export const NATURAL_LANGUAGE_RULES = `NATURAL LANGUAGE RULES (must follow):
- Write like a working travel planner briefing a client, not a brochure.
- Lead with concrete logistics: timing, distance/walk time, what to book, what to expect, and the tradeoff.
- Vary sentence length and rhythm. Avoid a uniform "Verb-the-noun" opening on every line.
- Use plain, specific wording: name the place, the dish, the line/route, the cost band.
- Explain why a choice works (sequencing, crowds, energy) instead of asserting it is special.
- These phrasings read as AI-generated filler. Rewrite them with concrete specifics rather than swapping in a synonym: gentle, hidden gem, unforgettable, seamless, curated, bespoke, magical, delightful, enchanting, vibrant, bustling, must-visit, dive into, immerse yourself, elevate, unlock, journey (as a metaphor), tapestry, nestled, charming, picturesque.

Example —
Weak (AI filler): "Enjoy a gentle morning discovering charming hidden gems."
Strong (planner): "Start at the market around 8am while stalls are setting up and it's quiet, then walk 10 minutes to the next stop so the day doesn't turn into backtracking."`;
