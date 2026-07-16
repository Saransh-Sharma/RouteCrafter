import type { WorkflowStageId } from "@/lib/readiness";

/** The product editor's flat surface model: four tabs, no stages. */
export type EditorTab = "trip" | "itinerary" | "pdf" | "listing";

export const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "trip", label: "Trip" },
  { id: "itinerary", label: "Itinerary" },
  { id: "pdf", label: "PDF" },
  { id: "listing", label: "Listing" },
];

export function isEditorTab(value: string | null): value is EditorTab {
  return EDITOR_TABS.some((tab) => tab.id === value);
}

/**
 * Map a readiness finding's legacy stage/tool coordinates onto the tab that
 * now hosts that content, so deep links keep working.
 */
export function tabForIssue(stage: WorkflowStageId, tool?: string): EditorTab {
  switch (stage) {
    case "define":
    case "plan":
      return "trip";
    case "build":
      return "itinerary";
    case "package":
      return tool === "pdf" ? "pdf" : "listing";
    case "publish":
      return "listing";
  }
}
