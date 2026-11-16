export type TravelProfile = "driving" | "foot" | "bike";

export type OrsRoute = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: string | null;
};

export type OrsPolygon = { type: "Polygon"; coordinates: number[][][] };

const SLUG: Record<TravelProfile, string> = {
  driving: "driving-car",
  foot: "foot-walking",
  bike: "cycling-regular",
};

export function orsBase(): string {
  return (process.env.OPENROUTESERVICE_BASE_URL ?? "https://api.heigit.org/openrouteservice").replace(/\/$/, "");
}

export function orsConfigured(): boolean {
  return Boolean(process.env.OPENROUTESERVICE_API_KEY);
}

export function readOrsDirection(payload: unknown, withGeometry: boolean): OrsRoute | null {
  if (!payload || typeof payload !== "object") return null;
  const feature = (payload as { features?: unknown[] }).features?.[0];
  if (!feature || typeof feature !== "object") return null;
  const summary = (feature as { properties?: { summary?: { distance?: number; duration?: number } } }).properties?.summary;
  if (summary?.distance == null || summary?.duration == null) return null;
  const geometry = (feature as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
  const line = geometry?.type === "LineString" && Array.isArray(geometry.coordinates) ? geometry : null;
  return {
    distanceMeters: Math.round(summary.distance),
    durationSeconds: Math.round(summary.duration),
    geometry: withGeometry && line ? JSON.stringify({ type: "LineString", coordinates: line.coordinates }) : null,
  };
}

export function readOrsIsochrone(payload: unknown): OrsPolygon | null {
  if (!payload || typeof payload !== "object") return null;
  const geometry = (payload as { features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }> }).features?.[0]?.geometry;
  if (geometry?.type !== "Polygon" || !Array.isArray(geometry.coordinates)) return null;
  return { type: "Polygon", coordinates: geometry.coordinates as number[][][] };
}

export async function fetchOpenRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  profile: TravelProfile,
  withGeometry: boolean,
): Promise<OrsRoute | null> {
  const key = process.env.OPENROUTESERVICE_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch(`${orsBase()}/v2/directions/${SLUG[profile]}/geojson`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/json, application/geo+json",
      },
      body: JSON.stringify({
        coordinates: [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    return readOrsDirection(await response.json(), withGeometry);
  } catch {
    return null;
  }
}

export async function fetchOpenIsochrone(
  latitude: number,
  longitude: number,
  minutes: number,
  profile: TravelProfile,
): Promise<OrsPolygon | null> {
  const key = process.env.OPENROUTESERVICE_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch(`${orsBase()}/v2/isochrones/${SLUG[profile]}`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/json, application/geo+json",
      },
      body: JSON.stringify({
        locations: [[longitude, latitude]],
        range: [Math.round(minutes * 60)],
        range_type: "time",
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    return readOrsIsochrone(await response.json());
  } catch {
    return null;
  }
}
