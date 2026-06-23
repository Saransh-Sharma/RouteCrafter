export interface GeocodeCandidate {
  lat: number;
  lng: number;
  label: string;
  provider: string;
  confidence?: number;
}

const cache = new Map<string, GeocodeCandidate[]>();
let nextRequestAt = 0;
export const MAX_GEOCODE_CACHE_SIZE = 100;

export function geocodeCacheKey(
  query: string,
  country: string | undefined,
  limit: number,
): string {
  return `${query.trim().toLowerCase()}::${country?.trim().toLowerCase() ?? ""}::${limit}`;
}

export function readGeocodeCache(
  query: string,
  country?: string,
  limit = 3,
): GeocodeCandidate[] | undefined {
  return cache
    .get(geocodeCacheKey(query, country, limit))
    ?.map((candidate) => ({ ...candidate }));
}

export function writeGeocodeCache(
  query: string,
  country: string | undefined,
  limit: number,
  candidates: GeocodeCandidate[],
): void {
  const key = geocodeCacheKey(query, country, limit);
  if (cache.has(key)) cache.delete(key);
  while (cache.size >= MAX_GEOCODE_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
  cache.set(
    key,
    candidates.map((candidate) => ({ ...candidate })),
  );
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
