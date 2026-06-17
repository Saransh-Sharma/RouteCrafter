import { describe, expect, it } from "vitest";
import {
  AI_ERROR,
  isRetryableErrorMessage,
  isRetryableHttpStatus,
  isRetryableThrownError,
  normalizeThrownError,
  providerErrorFromStatus,
} from "./errors";

describe("AI error helpers", () => {
  it("classifies retryable HTTP statuses", () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(401)).toBe(false);
    expect(isRetryableHttpStatus(400)).toBe(false);
  });

  it("maps provider HTTP statuses to canonical messages", () => {
    expect(providerErrorFromStatus(401)).toBe(AI_ERROR.AUTH_FAILED);
    expect(providerErrorFromStatus(429)).toBe(AI_ERROR.RATE_LIMIT);
    expect(providerErrorFromStatus(503)).toBe(AI_ERROR.PROVIDER_UNAVAILABLE);
    expect(providerErrorFromStatus(400, "bad prompt")).toBe("bad prompt");
  });

  it("detects retryable user-facing messages", () => {
    expect(isRetryableErrorMessage(AI_ERROR.PROVIDER_UNAVAILABLE)).toBe(true);
    expect(isRetryableErrorMessage(AI_ERROR.PROVIDER_TIMEOUT)).toBe(true);
    expect(isRetryableErrorMessage(AI_ERROR.RATE_LIMIT)).toBe(true);
    expect(isRetryableErrorMessage(AI_ERROR.AUTH_FAILED)).toBe(false);
    expect(isRetryableErrorMessage("This provider does not support image generation here.")).toBe(
      false,
    );
  });

  it("does not retry abort or unknown thrown values", () => {
    expect(isRetryableThrownError(new DOMException("Aborted", "AbortError"))).toBe(
      false,
    );
    expect(isRetryableThrownError(new Error(AI_ERROR.PROVIDER_TIMEOUT))).toBe(true);
    expect(isRetryableThrownError("unexpected")).toBe(false);
  });

  it("normalizes thrown errors", () => {
    expect(normalizeThrownError(new DOMException("Aborted", "AbortError"))).toBe(
      AI_ERROR.CANCELLED,
    );
    expect(normalizeThrownError(new Error("custom"))).toBe("custom");
    expect(normalizeThrownError(null)).toBe(AI_ERROR.DID_NOT_COMPLETE);
  });
});
