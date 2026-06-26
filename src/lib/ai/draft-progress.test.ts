import { describe, expect, it } from "vitest";
import {
  draftedDayCount,
  upsertProgress,
  visibleDraftProgress,
} from "./draft-progress";
import type { DraftProgress } from "./types";

describe("AI draft progress helpers", () => {
  it("upserts progress by id", () => {
    const first: DraftProgress = {
      id: "overview",
      kind: "overview",
      label: "Overview",
      status: "start",
    };
    const done: DraftProgress = { ...first, status: "done" };

    expect(upsertProgress([first], done)).toEqual([done]);
  });

  it("counts completed day ranges", () => {
    expect(
      draftedDayCount([
        {
          id: "days-1-3",
          kind: "days",
          label: "Days 1-3",
          status: "done",
          dayRange: [1, 3],
        },
      ]),
    ).toBe(3);
  });

  it("shows a default overview step before progress arrives", () => {
    expect(visibleDraftProgress([])[0]).toMatchObject({
      id: "overview",
      status: "start",
    });
  });
});
