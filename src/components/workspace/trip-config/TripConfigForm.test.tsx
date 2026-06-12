import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTripConfig } from "@/lib/schemas";
import { seedProjects } from "@/lib/seed-projects";
import type { Project } from "@/lib/types";
import { TripConfigForm } from "./TripConfigForm";

const mocks = vi.hoisted(() => ({
  update: vi.fn<
    (id: string, patch: Partial<Project>) => { ok: true }
  >(() => ({ ok: true })),
}));

vi.mock("@/lib/store/projects-store", () => ({
  useProjectsStore: (
    selector: (state: { update: typeof mocks.update }) => unknown,
  ) => selector({ update: mocks.update }),
}));

function configuredProject(): Project {
  return {
    ...structuredClone(seedProjects[0]),
    tripConfigs: [
      createEmptyTripConfig({
        id: "config",
        duration: "7 days",
        customDays: 9,
      }),
    ],
  };
}

describe("TripConfigForm auto-save", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.update.mockClear();
  });

  it("normalizes a cleared custom-day input before saving", async () => {
    render(<TripConfigForm project={configuredProject()} />);
    fireEvent.change(screen.getByLabelText("Custom days (optional)"), {
      target: { value: "" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });

    expect(mocks.update).toHaveBeenCalledTimes(1);
    const patch = mocks.update.mock.calls[0][1] as {
      tripConfigs: Array<{ customDays?: number }>;
    };
    expect(patch.tripConfigs[0].customDays).toBeUndefined();
    expect(screen.getByText("All changes saved")).toBeDefined();
  });

  it.each(["2.5", "-1", "61"])(
    "does not persist invalid custom-day value %s",
    async (value) => {
      render(<TripConfigForm project={configuredProject()} />);
      fireEvent.change(screen.getByLabelText("Custom days (optional)"), {
        target: { value },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(650);
      });

      expect(mocks.update).not.toHaveBeenCalled();
      expect(screen.queryByText("All changes saved")).toBeNull();
    },
  );
});
