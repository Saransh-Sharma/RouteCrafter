export interface GeocodeCandidate {
  lat: number;
  lng: number;
  label: string;
  provider: string;
  confidence?: number;
}

const cache = new Map<string, GeocodeCandidate[]>();
let nextRequestAt = 0;

export function geocodeCacheKey(query: string, country?: string): string {
  return `${query.trim().toLowerCase()}::${country?.trim().toLowerCase() ?? ""}`;
}

export function readGeocodeCache(
  query: string,
  country?: string,
): GeocodeCandidate[] | undefined {
  return cache.get(geocodeCacheKey(query, country));
}

export function writeGeocodeCache(
  query: string,
  country: string | undefined,
  candidates: GeocodeCandidate[],
): void {
  cache.set(geocodeCacheKey(query, country), candidates);
}

export function clearGeocodeCacheForTests(): void {
  cache.clear();
  nextRequestAt = 0;
}

export async function throttleNominatimRequest(now = Date.now()): Promise<void> {
  const waitMs = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + 1000;
  if (waitMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}
