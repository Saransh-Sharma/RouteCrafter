import { describe, expect, it } from "vitest";
import { tripConfigurationSchema } from "./trip-config";

const base = {
  id: "config",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("trip configuration custom days", () => {
  it("normalizes blank and NaN values to undefined", () => {
    expect(tripConfigurationSchema.parse({ ...base, customDays: "" }).customDays)
      .toBeUndefined();
    expect(
      tripConfigurationSchema.parse({ ...base, customDays: Number.NaN })
        .customDays,
    ).toBeUndefined();
  });

  it.each([0, -1, 2.5, 61])("rejects invalid custom day value %s", (value) => {
    expect(
      tripConfigurationSchema.safeParse({ ...base, customDays: value }).success,
    ).toBe(false);
  });
});
