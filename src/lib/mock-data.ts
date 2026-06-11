import type { WorkspaceModule } from "./types";

/** Workspace module sections shown in the project shell. */
export const workspaceModules: WorkspaceModule[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Positioning, audience, and project summary at a glance.",
    phase: 1,
  },
  {
    id: "trip-config",
    label: "Trip Configuration",
    description:
      "Deeply configurable trip parameters that drive every generated output.",
    phase: 3,
  },
  {
    id: "prompts",
    label: "Prompt Studio",
    description: "Config-aware, copy-paste prompts for every deliverable.",
    phase: 4,
  },
  {
    id: "image-prompts",
    label: "Image Prompts",
    description: "Five country-specific portfolio image prompts for listings.",
    phase: 5,
  },
  {
    id: "matrix",
    label: "Itinerary Matrix",
    description: "Compact duration × traveler-type variation grid.",
    phase: 6,
  },
  {
    id: "expanded",
    label: "Expanded Itinerary",
    description: "Full day-by-day itinerary with editable sections.",
    phase: 7,
  },
  {
    id: "listing",
    label: "Listing Copy",
    description: "Gig titles, descriptions, packages, FAQs, and requirements.",
    phase: 8,
  },
  {
    id: "pdf",
    label: "PDF Builder",
    description: "Premium, print-ready itinerary document preview.",
    phase: 9,
  },
  {
    id: "export",
    label: "Export",
    description: "PDF, Markdown, CSV, and JSON outputs and history.",
    phase: 10,
  },
];
