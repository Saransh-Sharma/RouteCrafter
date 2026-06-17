import { afterEach, describe, expect, it } from "vitest";
import { isCloudPersistenceEnabled } from "./config";

describe("cloud persistence config", () => {
  const original = process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED = original;
  });

  it("keeps cloud persistence disabled by default", () => {
    delete process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED;

    expect(isCloudPersistenceEnabled()).toBe(false);
  });

  it("enables cloud persistence explicitly", () => {
    process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED = "true";

    expect(isCloudPersistenceEnabled()).toBe(true);
  });
});
