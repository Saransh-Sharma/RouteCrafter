// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearGeocodeCacheForTests,
  MAX_GEOCODE_CACHE_SIZE,
  readGeocodeCache,
  writeGeocodeCache,
} from "./cache";
import { searchGeocodeCandidates } from "./provider";

describe("geocoding provider", () => {
  beforeEach(() => {
    vi.stubEnv("GEOCODING_CONTACT_URL", "https://routecrafter.example");
  });

  afterEach(() => {
    vi.useRealTimers();
    clearGeocodeCacheForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps Nominatim responses to RouteCrafter candidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([
        {
          lat: "35.0116",
          lon: "135.7681",
          display_name: "Kyoto, Japan",
          importance: 0.82,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await searchGeocodeCandidates({
      query: "Kyoto",
      country: "Japan",
    });

    expect(candidates).toEqual([
      {
        lat: 35.0116,
        lng: 135.7681,
        label: "Kyoto, Japan",
        provider: "nominatim",
        confidence: 0.82,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("RouteCrafter"),
        }),
      }),
    );
  });

  it("returns cached candidates without a second provider call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([
        {
          lat: "35",
          lon: "135",
          display_name: "Kyoto, Japan",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchGeocodeCandidates({ query: "Kyoto", country: "Japan" });
    await searchGeocodeCandidates({ query: " kyoto ", country: " japan " });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches different limit values separately", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          {
            lat: "35",
            lon: "135",
            display_name: "Kyoto, Japan",
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            lat: "35",
            lon: "135",
            display_name: "Kyoto, Japan",
          },
          {
            lat: "34.7",
            lon: "135.5",
            display_name: "Osaka, Japan",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const one = await searchGeocodeCandidates({
      query: "Kyoto",
      country: "Japan",
      limit: 1,
    });
    const three = await searchGeocodeCandidates({
      query: "Kyoto",
      country: "Japan",
      limit: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      ((fetchMock.mock.calls[0]?.[0] as URL).searchParams.get("limit")),
    ).toBe("1");
    expect(
      ((fetchMock.mock.calls[1]?.[0] as URL).searchParams.get("limit")),
    ).toBe("3");
    expect(one).toHaveLength(1);
    expect(three).toHaveLength(2);
  });

  it("evicts oldest cache entries after the maximum size", () => {
    for (let index = 0; index < MAX_GEOCODE_CACHE_SIZE; index += 1) {
      writeGeocodeCache(`City ${index}`, undefined, 3, [
        { lat: index, lng: index, label: `City ${index}`, provider: "test" },
      ]);
    }

    writeGeocodeCache("Overflow", undefined, 3, [
      { lat: 999, lng: 999, label: "Overflow", provider: "test" },
    ]);

    expect(readGeocodeCache("City 0", undefined, 3)).toBeUndefined();
    expect(readGeocodeCache("Overflow", undefined, 3)).toEqual([
      { lat: 999, lng: 999, label: "Overflow", provider: "test" },
    ]);
  });

  it("does not expose mutable cache references", () => {
    const original = [
      { lat: 35, lng: 135, label: "Kyoto, Japan", provider: "test" },
    ];
    writeGeocodeCache("Kyoto", "Japan", 3, original);
    original[0].label = "Mutated before read";

    const firstRead = readGeocodeCache("Kyoto", "Japan", 3);
    expect(firstRead).toEqual([
      { lat: 35, lng: 135, label: "Kyoto, Japan", provider: "test" },
    ]);
    firstRead![0].label = "Mutated after read";

    expect(readGeocodeCache("Kyoto", "Japan", 3)).toEqual([
      { lat: 35, lng: 135, label: "Kyoto, Japan", provider: "test" },
    ]);
  });

  it.each([
    { limit: Number.NaN, expected: "3" },
    { limit: 2.8, expected: "2" },
    { limit: 0, expected: "1" },
    { limit: 99, expected: "5" },
  ])("normalizes invalid or out-of-range limits %#", async ({ limit, expected }) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetchMock);

    await searchGeocodeCandidates({
      query: `Kyoto ${expected}`,
      country: "Japan",
      limit,
    });

    expect(
      ((fetchMock.mock.calls[0]?.[0] as URL).searchParams.get("limit")),
    ).toBe(expected);
  });

  it("aborts requests that exceed the geocoding timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GEOCODING_TIMEOUT_MS", "10");
    const fetchMock = vi.fn(
      (_url: URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = searchGeocodeCandidates({
      query: "Kyoto",
      country: "Japan",
    });
    const assertion = expect(request).rejects.toThrow(
      "Geocoder request timed out.",
    );
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list for empty input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchGeocodeCandidates({ query: " " })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
