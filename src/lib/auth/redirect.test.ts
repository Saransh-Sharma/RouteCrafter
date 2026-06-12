import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "./redirect";

describe("sanitizeRedirectPath", () => {
  it.each([
    [null, "/"],
    ["", "/"],
    ["https://example.com", "/"],
    ["//example.com/path", "/"],
    ["javascript:alert(1)", "/"],
    ["/projects/123?tab=pdf#preview", "/projects/123?tab=pdf#preview"],
  ])("sanitizes %s", (input, expected) => {
    expect(sanitizeRedirectPath(input)).toBe(expected);
  });
});
