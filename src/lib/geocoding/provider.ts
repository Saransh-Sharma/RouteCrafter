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

const DEFAULT_GEOCODING_TIMEOUT_MS = 8000;

function normalizeLimit(limit: number): number {
  return Math.max(1, Math.min(limit, 5));
}

function geocodingTimeoutMs(): number {
  const configured = Number(process.env.GEOCODING_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_GEOCODING_TIMEOUT_MS;
}

function geocodingContactUrl(): string {
  const raw =
    process.env.GEOCODING_CONTACT_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!raw) {
    throw new Error("GEOCODING_CONTACT_URL is required for Nominatim geocoding.");
  }
  const contact = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (/\.local(?:[/:]|$)/i.test(contact)) {
    throw new Error("GEOCODING_CONTACT_URL must be a public contact URL.");
  }
  return contact;
}

function userAgent(): string {
  return `RouteCrafter/0.1 geocoding (${geocodingContactUrl()})`;
}

export async function searchGeocodeCandidates({
  query,
  country,
  limit = 3,
}: SearchGeocodeInput): Promise<GeocodeCandidate[]> {
  const normalizedQuery = query.trim();
  const normalizedCountry = country?.trim();
  const normalizedLimit = normalizeLimit(limit);
  if (!normalizedQuery) return [];

  const cached = readGeocodeCache(
    normalizedQuery,
    normalizedCountry,
    normalizedLimit,
  );
  if (cached) return cached;

  await throttleNominatimRequest();
  const search = [normalizedQuery, normalizedCountry].filter(Boolean).join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(normalizedLimit));
  url.searchParams.set("q", search);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geocodingTimeoutMs());
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(),
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Geocoder request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
  const limited = candidates.slice(0, normalizedLimit);
  writeGeocodeCache(normalizedQuery, normalizedCountry, normalizedLimit, limited);
  return limited;
}
