"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadGoogleMaps,
  type GoogleMapInstance,
  type GoogleMapsNamespace,
  type GoogleOverlayViewInstance,
  type GooglePolygonInstance,
  type GooglePolylineInstance,
} from "@/components/maps/google-maps-loader";

export const LISTING_COLORS = ["#1e4638", "#b8612f", "#245b8a", "#6d3b74", "#8d2f2f", "#2f6b4f", "#9a5b12", "#3e6b62"];

export type MarkerPreview = {
  price?: string | null;
  lines?: string[];
  badges?: string[];
  imageUrl?: string | null;
  sourceUrl?: string | null;
};

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  tone: "office" | "listing" | "pin";
  color?: string;
  href?: string;
  rank?: number;
  preview?: MarkerPreview;
};

const HOUSE = `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" stroke="white" stroke-width="1.2" d="M12 3.2 3 11h2.2v8.2h5.1v-4.6h3.4v4.6h5.1V11H21z"/></svg>`;
const PIN = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" stroke="white" stroke-width="1.2" d="M12 2.2a6.8 6.8 0 0 0-6.8 6.8c0 5 6.8 12.8 6.8 12.8s6.8-7.8 6.8-12.8A6.8 6.8 0 0 0 12 2.2zm0 9.2a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8z"/></svg>`;

export type MapShape = {
  id: string;
  color: string;
  width?: number;
  geojson: { type: "Polygon" | "LineString"; coordinates: number[] | number[][] | number[][][] };
};

function createMarkerElement(item: MapMarker, isActive: boolean, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `kos-marker${isActive ? " is-active" : ""}`;
  element.setAttribute("aria-label", item.rank ? `${item.rank}. ${item.label}` : item.label);
  element.style.position = "absolute";
  element.style.transform = "translate(-50%, -100%)";

  const glyph = document.createElement("span");
  glyph.className = "marker-glyph";
  glyph.style.color = item.color ?? (item.tone === "office" ? "#b8612f" : "#1e4638");
  glyph.innerHTML = item.tone === "listing" ? HOUSE : PIN;
  if (item.rank) {
    const rank = document.createElement("span");
    rank.className = "marker-rank";
    rank.textContent = String(item.rank);
    glyph.append(rank);
  }

  const tip = document.createElement("span");
  tip.className = "marker-tip";
  tip.textContent = item.rank ? `${item.rank}. ${item.label}` : item.label;
  element.append(glyph, tip);

  element.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    onClick();
  });

  return element;
}

function createOverlayMarker(
  gmaps: GoogleMapsNamespace,
  map: GoogleMapInstance,
  item: MapMarker,
  isActive: boolean,
  onClick: () => void,
): GoogleOverlayViewInstance {
  const overlay = new gmaps.OverlayView();
  let element: HTMLButtonElement | null = null;

  overlay.onAdd = () => {
    element = createMarkerElement(item, isActive, onClick);
    const panes = overlay.getPanes();
    panes?.overlayMouseTarget.appendChild(element);
  };

  overlay.draw = () => {
    if (!element) return;
    const projection = overlay.getProjection();
    if (!projection) return;
    const point = projection.fromLatLngToDivPixel(new gmaps.LatLng(item.latitude, item.longitude));
    if (!point) return;
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  };

  overlay.onRemove = () => {
    if (element) {
      element.remove();
      element = null;
    }
  };

  overlay.setMap(map);
  return overlay;
}

function isClockwise(ring: Array<{ lat: number; lng: number }>): boolean {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += (b.lng - a.lng) * (b.lat + a.lat);
  }
  return area > 0;
}

const WORLD_RING_CW = [
  { lat: 85, lng: -179 },
  { lat: 85, lng: 0 },
  { lat: 85, lng: 179 },
  { lat: -85, lng: 179 },
  { lat: -85, lng: 0 },
  { lat: -85, lng: -179 },
];

const WORLD_RING_CCW = [...WORLD_RING_CW].reverse();

export function KosMap({
  markers,
  shapes = [],
  onPick,
  onSelect,
  focusId,
  fitIds,
  fitPath,
  showPreview = true,
  className,
}: {
  markers: MapMarker[];
  shapes?: MapShape[];
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  onSelect?: (id: string) => void;
  focusId?: string | null;
  fitIds?: string[];
  fitPath?: number[][] | null;
  showPreview?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const gmapsRef = useRef<GoogleMapsNamespace | null>(null);
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  const closePreviewRef = useRef<() => void>(() => {});
  const lastIds = useRef("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const markerKey = JSON.stringify(markers);
  const shapeKey = JSON.stringify(shapes);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const fitKey = (fitIds ?? []).join("|");
  const pathKey = (fitPath ?? []).map((point) => `${point[0].toFixed(4)},${point[1].toFixed(4)}`).join(";");

  useEffect(() => {
    onPickRef.current = onPick;
    onSelectRef.current = onSelect;
  }, [onPick, onSelect]);

  useEffect(() => {
    closePreviewRef.current = () => setActiveId(null);
  }, []);

  const active = markers.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      setMapError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY belum diatur di .env.");
      return;
    }

    let cancelled = false;
    let clickListener: { remove: () => void } | null = null;

    loadGoogleMaps(apiKey)
      .then((gmaps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        gmapsRef.current = gmaps;
        const map = new gmaps.Map(containerRef.current, {
          center: { lat: -6.21, lng: 106.822 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        clickListener = map.addListener("click", (event) => {
          closePreviewRef.current();
          if (!event.latLng) return;
          onPickRef.current?.({
            latitude: Number(event.latLng.lat().toFixed(6)),
            longitude: Number(event.latLng.lng().toFixed(6)),
          });
        });

        mapRef.current = map;
        setMapReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMapError(error instanceof Error ? error.message : "Gagal memuat Google Maps.");
      });

    return () => {
      cancelled = true;
      clickListener?.remove();
      if (mapRef.current && gmapsRef.current) {
        gmapsRef.current.event.clearInstanceListeners(mapRef.current);
      }
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const gmaps = gmapsRef.current;
    if (!mapReady || !map || !gmaps) return;

    const drawn: GoogleOverlayViewInstance[] = [];
    const bounds = new gmaps.LatLngBounds();

    for (const item of markers) {
      const overlay = createOverlayMarker(gmaps, map, item, item.id === focusId, () => {
        setActiveId(item.id);
        onSelectRef.current?.(item.id);
      });
      drawn.push(overlay);
      const framed = !fitKey || fitKey.split("|").includes(item.id);
      if (framed) bounds.extend({ lat: item.latitude, lng: item.longitude });
    }

    const idKey = `${markers.map((item) => item.id).join("|")}::${fitKey}`;
    if (!bounds.isEmpty() && lastIds.current !== idKey) {
      lastIds.current = idKey;
      const framed = fitKey ? markers.filter((item) => fitKey.split("|").includes(item.id)) : markers;
      if (framed.length === 1) {
        map.panTo({ lat: framed[0].latitude, lng: framed[0].longitude });
        map.setZoom(15);
      } else {
        map.fitBounds(bounds, 56);
      }
    }

    return () => {
      for (const overlay of drawn) {
        overlay.setMap(null);
      }
    };
  }, [fitKey, focusId, mapReady, markerKey, markers]);

  const focusToken = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !focusId) {
      focusToken.current = focusId ?? null;
      return;
    }
    if (pathKey) return;
    const item = markers.find((marker) => marker.id === focusId);
    if (!item) return;
    if (focusToken.current === focusId) return;

    focusToken.current = focusId;
    map.panTo({ lat: item.latitude, lng: item.longitude });
    map.setZoom(Math.max(map.getZoom() ?? 12, 14));
  }, [focusId, mapReady, markers, pathKey]);

  useEffect(() => {
    const map = mapRef.current;
    const gmaps = gmapsRef.current;
    if (!mapReady || !map || !gmaps || !fitPath || fitPath.length < 2) return;

    const bounds = new gmaps.LatLngBounds();
    for (const point of fitPath) bounds.extend({ lat: point[1], lng: point[0] });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 72);
    }
  }, [fitPath, mapReady, pathKey]);

  useEffect(() => {
    const map = mapRef.current;
    const gmaps = gmapsRef.current;
    if (!mapReady || !map || !gmaps) return;

    const overlays: Array<GooglePolygonInstance | GooglePolylineInstance> = [];

    for (const shape of shapesRef.current) {
      if (shape.geojson.type === "Polygon") {
        const rings = (shape.geojson.coordinates as number[][][]).map((ring) =>
          ring.map(([lng, lat]) => ({ lat, lng })),
        );
        const primaryRing = rings[0];
        if (primaryRing && primaryRing.length >= 3) {
          const outerRing = isClockwise(primaryRing) ? WORLD_RING_CCW : WORLD_RING_CW;
          overlays.push(
            new gmaps.Polygon({
              paths: [outerRing, ...rings],
              fillColor: "#1f2937",
              fillOpacity: 0.18,
              strokeColor: shape.color,
              strokeOpacity: 0,
              strokeWeight: 0,
              clickable: false,
              map,
            }),
          );
        }
        overlays.push(
          new gmaps.Polygon({
            paths: rings,
            fillColor: shape.color,
            fillOpacity: 0,
            strokeColor: shape.color,
            strokeOpacity: 0.75,
            strokeWeight: 2,
            clickable: false,
            map,
          }),
        );
      } else if (shape.geojson.type === "LineString") {
        const path = (shape.geojson.coordinates as number[][]).map(([lng, lat]) => ({ lat, lng }));
        overlays.push(
          new gmaps.Polyline({
            path,
            strokeColor: shape.color,
            strokeOpacity: 0.9,
            strokeWeight: shape.width ?? 3,
            clickable: false,
            map,
          }),
        );
      }
    }

    return () => {
      for (const overlay of overlays) {
        overlay.setMap(null);
      }
    };
  }, [mapReady, shapeKey]);

  return (
    <div className={`map-shell ${className ?? "map-frame"}`}>
      {mapError ? <div className="map-loading">{mapError}</div> : <div ref={containerRef} className="map-canvas" />}
      {showPreview && active ? (
        <aside
          className="map-preview"
          role="dialog"
          aria-label={active.label}
          style={{
            left: "auto",
            right: "0.75rem",
            bottom: "0.75rem",
            width: "min(250px, calc(100% - 16rem))",
            maxHeight: "calc(100% - 1.5rem)",
            overflow: "auto",
            zIndex: 3,
          }}
        >
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>{active.label}</h2>
            <button className="btn secondary" type="button" onClick={() => setActiveId(null)}>
              Tutup
            </button>
          </div>
          {active.preview?.imageUrl ? (
            <img className="thumb" src={active.preview.imageUrl} alt="" style={{ width: "100%", height: 92, objectFit: "cover" }} />
          ) : null}
          {active.preview?.price ? <p>{active.preview.price}</p> : null}
          {active.preview?.lines?.map((line) => (
            <p key={line} className="muted">
              {line}
            </p>
          ))}
          {active.preview?.badges && active.preview.badges.length > 0 ? (
            <div className="row">
              {active.preview.badges.map((badge) => (
                <span key={badge} className="badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          <div className="row">
            {active.preview?.sourceUrl ? (
              <a className="btn secondary" href={active.preview.sourceUrl} target="_blank" rel="noreferrer">
                Situs asli
              </a>
            ) : null}
            {active.href ? (
              <a className="btn" href={active.href}>
                Selengkapnya
              </a>
            ) : null}
          </div>
          {active.href ? null : (
            <p className="help">Ini titik acuan jarak, bukan listing kos.</p>
          )}
        </aside>
      ) : null}
    </div>
  );
}
