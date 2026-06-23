import {
  readGeocodeCache,
  throttleNominatimRequest,
  writeGeocodeCache,
  type GeocodeCandidate,
} from "./cache";

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  importance?: number;
}

export interface SearchGeocodeInput {
  query: string;
  country?: string;
  limit?: number;
}

const USER_AGENT = "RouteCrafter/0.1 geocoding (https://routecrafter.local)";

export async function searchGeocodeCandidates({
  query,
  country,
  limit = 3,
}: SearchGeocodeInput): Promise<GeocodeCandidate[]> {
  const normalizedQuery = query.trim();
  const normalizedCountry = country?.trim();
  if (!normalizedQuery) return [];

  const cached = readGeocodeCache(normalizedQuery, normalizedCountry);
  if (cached) return cached.slice(0, limit);

  await throttleNominatimRequest();
  const search = [normalizedQuery, normalizedCountry].filter(Boolean).join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 5))));
  url.searchParams.set("q", search);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Geocoder returned ${response.status}.`);
  }
  const raw = (await response.json()) as NominatimResult[];
  const candidates = raw
    .map((item): GeocodeCandidate | null => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        lat,
        lng,
        label: item.display_name ?? normalizedQuery,
        provider: "nominatim",
        confidence: item.importance,
      };
    })
    .filter((item): item is GeocodeCandidate => Boolean(item));
  writeGeocodeCache(normalizedQuery, normalizedCountry, candidates);
  return candidates.slice(0, limit);
}
