export function aiResponseHeaders(providerAttempts?: number): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    ...(providerAttempts
      ? { "X-AI-Provider-Attempts": String(providerAttempts) }
      : {}),
  };
}
