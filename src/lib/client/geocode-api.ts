import type { GeocodeCandidate } from "@/lib/geocoding/cache";
import { requestJson } from "./http";

export function searchGeocode(input: {
  query: string;
  country?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ candidates?: GeocodeCandidate[] }> {
  return requestJson<{ candidates?: GeocodeCandidate[] }>(
    "/api/geocode/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        country: input.country,
        limit: input.limit,
      }),
      signal: input.signal,
    },
    "Geocoding failed.",
  );
}
