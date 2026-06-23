// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGeocodeCacheForTests } from "./cache";
import { searchGeocodeCandidates } from "./provider";

describe("geocoding provider", () => {
  afterEach(() => {
    clearGeocodeCacheForTests();
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

  it("returns an empty list for empty input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchGeocodeCandidates({ query: " " })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
