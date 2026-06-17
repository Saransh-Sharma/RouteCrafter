import { afterEach, describe, expect, it } from "vitest";
import { isCloudPersistenceEnabled } from "./config";

describe("cloud persistence config", () => {
  const original = process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED = original;
  });

  it("enables cloud persistence by default for the shared workspace", () => {
    delete process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED;

    expect(isCloudPersistenceEnabled()).toBe(true);
  });

  it("still enables cloud persistence when set explicitly to true", () => {
    process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED = "true";

    expect(isCloudPersistenceEnabled()).toBe(true);
  });

  it("only disables cloud persistence when explicitly set to false", () => {
    process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED = "false";

    expect(isCloudPersistenceEnabled()).toBe(false);
  });
});
