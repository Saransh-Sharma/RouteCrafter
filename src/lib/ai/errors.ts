export const AI_ERROR = {
  PROVIDER_UNAVAILABLE:
    "The provider is temporarily unavailable. No project content was changed.",
  PROVIDER_TIMEOUT:
    "The provider request timed out. Try again or reduce the request size.",
  RATE_LIMIT: "Provider rate limit reached. Wait or switch models.",
  AUTH_FAILED: "Provider authentication failed.",
  CANCELLED: "The request was cancelled. No project content was changed.",
  DID_NOT_COMPLETE: "The AI request did not complete. No project content was changed.",
  REJECTED: "The provider rejected this request.",
} as const;

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isRetryableErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  if (normalized.includes("cancelled")) return false;
  if (normalized.includes("authentication failed")) return false;
  if (normalized.includes("does not support")) return false;
  if (normalized.includes("rejected this request")) return false;
  if (normalized.includes("invalid")) return false;
  return (
    normalized.includes(AI_ERROR.PROVIDER_UNAVAILABLE.toLowerCase()) ||
    normalized.includes("timed out") ||
    normalized.includes("rate limit") ||
    normalized.includes(AI_ERROR.DID_NOT_COMPLETE.toLowerCase()) ||
    normalized.includes("fetch failed") ||
    normalized.includes("network")
  );
}

export function isRetryableThrownError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return false;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return false;
    return isRetryableErrorMessage(error.message);
  }
  return false;
}

export function providerErrorFromStatus(status: number, raw?: string): string {
  if (status === 401 || status === 403) return AI_ERROR.AUTH_FAILED;
  if (status === 429) return AI_ERROR.RATE_LIMIT;
  if (status >= 500) return AI_ERROR.PROVIDER_UNAVAILABLE;
  return raw || AI_ERROR.REJECTED;
}

export function normalizeThrownError(error: unknown): string {
  if (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === "AbortError"
  ) {
    return AI_ERROR.CANCELLED;
  }
  if (error instanceof Error) return error.message;
  return AI_ERROR.DID_NOT_COMPLETE;
}
