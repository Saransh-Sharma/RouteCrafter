import { describe, expect, it } from "vitest";
import {
  applyJsonReviewChoices,
  flattenJsonRows,
  getJsonPath,
  initialMergeValues,
  initialReviewChoices,
  parseJsonValue,
} from "./json-review";

describe("AI JSON review helpers", () => {
  it("flattens nested object and array paths against current values", () => {
    const rows = flattenJsonRows(
      { title: "AI", days: [{ title: "Day 1", tags: ["food"] }] },
      { title: "Current", days: [{ title: "", tags: [] }] },
    );

    expect(rows.map((row) => row.path)).toEqual([
      "title",
      "days.0.title",
      "days.0.tags",
    ]);
    expect(rows[1]).toMatchObject({ currentValue: "", aiValue: "Day 1" });
  });

  it("defaults empty current fields to use AI and filled fields to keep current", () => {
    const rows = flattenJsonRows({ title: "AI", summary: "Draft" }, { title: "" });

    expect(initialReviewChoices(rows)).toEqual({
      title: "use-ai",
      summary: "use-ai",
    });
  });

  it("applies selected AI and merge values without mutating current JSON", () => {
    const current = { title: "Current", days: [{ title: "" }] };
    const rows = flattenJsonRows(
      { title: "AI", days: [{ title: "Day 1" }] },
      current,
    );
    const next = applyJsonReviewChoices({
      current,
      rows,
      choices: {
        ...initialReviewChoices(rows),
        title: "merge",
        "days.0.title": "use-ai",
      },
      mergeValues: { ...initialMergeValues(rows), title: "Merged" },
    });

    expect(getJsonPath(next, "title")).toBe("Merged");
    expect(getJsonPath(next, "days.0.title")).toBe("Day 1");
    expect(current.title).toBe("Current");
  });

  it("returns null for invalid JSON", () => {
    expect(parseJsonValue("{broken")).toBeNull();
  });
});
