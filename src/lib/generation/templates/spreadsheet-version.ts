import type { PromptTemplate } from "../types";
import { configBlock, durationLabel } from "../context";
import { REALISM_RULES } from "../realism";

export const spreadsheetVersionTemplate: PromptTemplate = {
  id: "spreadsheet-version",
  label: "Spreadsheet-friendly itinerary",
  group: "Itinerary",
  description: "Itinerary as a CSV/Sheets-friendly table.",
  build: (ctx) => `Convert a ${durationLabel(ctx)} ${ctx.project.country || "country"} itinerary into a spreadsheet-friendly table.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Output a single table (CSV or tab-separated) with exactly these columns, one row per time block:
Day, Date placeholder, City/Base, Time block, Activity, Area, Food suggestion, Transport, Booking required, Cost level, Pace, Notes, Backup option

Rules:
- Use "Morning", "Afternoon", or "Evening" for Time block.
- "Booking required" = Yes/No. "Cost level" = $/$$/$$$.
- Keep cells concise so they paste cleanly into Google Sheets.
- Do not include real-time prices; use cost levels only.

${REALISM_RULES}`,
};
