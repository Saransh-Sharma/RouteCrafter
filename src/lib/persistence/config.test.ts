import { afterEach, describe, expect, it } from "vitest";
import { isCloudPersistenceEnabled } from "./config";

describe("cloud persistence config", () => {
  const original = process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED = original;
  });

  it("enables cloud persistence by default", () => {
    delete process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED;

    expect(isCloudPersistenceEnabled()).toBe(true);
  });

  it("allows cloud persistence to be explicitly disabled", () => {
    process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED = "false";

    expect(isCloudPersistenceEnabled()).toBe(false);
  });
});
