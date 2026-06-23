"use client";

import * as React from "react";
import type { StyleSpecification } from "maplibre-gl";
import type { RouteStop } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function RouteMap({
  route,
  activeStopId,
  onHoverStop,
}: {
  route: RouteStop[];
  activeStopId?: string | null;
  onHoverStop?: (id: string | null) => void;
}) {
  const mapNode = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = React.useRef<import("maplibre-gl").Marker[]>([]);
  const [failed, setFailed] = React.useState(false);
  const stopsWithCoords = route.filter((stop) => stop.coords);

  const renderMap = React.useCallback(
    (maplibre: typeof import("maplibre-gl")) => {
      const map = mapRef.current;
      if (!map) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      const coordinates = stopsWithCoords.map((stop) => [
        stop.coords!.lng,
        stop.coords!.lat,
      ]);
      const source = map.getSource("route-line") as
        | import("maplibre-gl").GeoJSONSource
        | undefined;
      const data = {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {},
      } as GeoJSON.Feature<GeoJSON.LineString>;
      if (source) source.setData(data);
      else {
        map.addSource("route-line", { type: "geojson", data });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route-line",
          paint: {
            "line-color": "#426b55",
            "line-width": 3,
            "line-dasharray": [1, 1.5],
          },
        });
      }
      stopsWithCoords.forEach((stop, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.textContent = String(index + 1);
        el.setAttribute("aria-label", `Stop ${index + 1}: ${stop.city}`);
        el.className = cn(
          "grid size-8 place-items-center rounded-full border-2 border-paper bg-forest text-xs font-bold text-paper shadow-[var(--shadow-lift)] transition-transform",
          activeStopId === stop.id && "scale-125 bg-terracotta",
        );
        el.addEventListener("mouseenter", () => onHoverStop?.(stop.id));
        el.addEventListener("mouseleave", () => onHoverStop?.(null));
        markersRef.current.push(
          new maplibre.Marker({ element: el })
            .setLngLat([stop.coords!.lng, stop.coords!.lat])
            .addTo(map),
        );
      });
      const bounds = coordinates.reduce(
        (box, coord) => box.extend(coord as [number, number]),
        new maplibre.LngLatBounds(
          coordinates[0] as [number, number],
          coordinates[0] as [number, number],
        ),
      );
      map.fitBounds(bounds, { padding: 48, duration: 350 });
    },
    [activeStopId, onHoverStop, stopsWithCoords],
  );

  React.useEffect(() => {
    let cancelled = false;
    async function mount() {
      if (!mapNode.current || mapRef.current || stopsWithCoords.length < 2) return;
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !mapNode.current) return;
        const first = stopsWithCoords[0].coords!;
        mapRef.current = new maplibre.Map({
          container: mapNode.current,
          style: OSM_STYLE,
          center: [first.lng, first.lat],
          zoom: 4,
          attributionControl: false,
        });
        mapRef.current.on("load", () => renderMap(maplibre));
      } catch {
        setFailed(true);
      }
    }
    void mount();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsWithCoords.length]);

  React.useEffect(() => {
    async function render() {
      const maplibre = await import("maplibre-gl");
      renderMap(maplibre);
    }
    if (mapRef.current?.loaded()) void render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, activeStopId]);

  React.useEffect(
    () => () => {
      markersRef.current.forEach((marker) => marker.remove());
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  if (failed || stopsWithCoords.length < 2) {
    return (
      <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-border-strong bg-paper/45 p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-ink">Map preview</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-ink-muted">
            Geocode at least two stops to draw the route map. The route rail below
            remains the source of truth.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong bg-paper">
      <div ref={mapNode} className="h-64 w-full" />
      <div className="border-t border-border-soft px-3 py-2 text-[11px] text-ink-muted">
        Map tiles © OpenStreetMap contributors. Geocoding by Nominatim.
      </div>
    </div>
  );
}
