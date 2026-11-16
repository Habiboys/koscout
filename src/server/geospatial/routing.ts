import { prisma } from "@/server/db";
import { fetchOpenRoute, orsConfigured } from "@/server/geospatial/ors";
import { routeCacheKey, type RoutePoint } from "@/server/geospatial/route-key";

const FETCH_LIMIT = 20;

export type { RoutePoint };
export { routeCacheKey };

export type RouteProfile = "driving" | "foot" | "bike";

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: string | null;
};

export async function getCachedRoute(
  from: RoutePoint,
  to: RoutePoint,
  profile: RouteProfile = "driving",
): Promise<RouteResult | null> {
  const cached = await prisma.routeCache.findUnique({
    where: { cacheKey: routeCacheKey(from, to, profile) },
  });
  if (!cached) return null;
  if (orsConfigured() && cached.provider !== "ors") return null;
  return {
    distanceMeters: cached.distanceMeters,
    durationSeconds: cached.durationSeconds,
    geometry: cached.geometry,
  };
}

export async function fetchDrivingRoute(from: RoutePoint, to: RoutePoint): Promise<RouteResult | null> {
  return fetchRoute(from, to, "driving", true);
}

export function routeProviderName(): string {
  return orsConfigured() ? "OpenRouteService" : "OSRM";
}

function baseFor(profile: RouteProfile): string {
  const fallback = (process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
  if (profile === "foot") return (process.env.OSRM_FOOT_URL ?? "https://routing.openstreetmap.de/routed-foot").replace(/\/$/, "");
  if (profile === "bike") return (process.env.OSRM_BIKE_URL ?? "https://routing.openstreetmap.de/routed-bike").replace(/\/$/, "");
  return fallback;
}

export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
  profile: RouteProfile = "driving",
  withGeometry = false,
): Promise<RouteResult | null> {
  if (orsConfigured()) return fetchOpenRoute(from, to, profile, withGeometry);
  const base = baseFor(profile);
  const path = `${round(from.longitude)},${round(from.latitude)};${round(to.longitude)},${round(to.latitude)}`;
  const overview = withGeometry ? "full" : "false";
  const url = `${base}/route/v1/${profile}/${path}?overview=${overview}&geometries=geojson`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{ distance?: number; duration?: number; geometry?: unknown }>;
    };
    const route = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!route || route.distance == null || route.duration == null) {
      return null;
    }
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      geometry: withGeometry && route.geometry ? JSON.stringify(route.geometry) : null,
    };
  } catch {
    return null;
  }
}

export async function rememberRoute(
  from: RoutePoint,
  to: RoutePoint,
  route: RouteResult,
  profile: RouteProfile = "driving",
): Promise<void> {
  const cacheKey = routeCacheKey(from, to, profile);
  const provider = orsConfigured() ? "ors" : "osrm";
  await prisma.routeCache.upsert({
    where: { cacheKey },
    update: {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      geometry: route.geometry ?? undefined,
      provider,
      fetchedAt: new Date(),
    },
    create: {
      cacheKey,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      geometry: route.geometry,
      provider,
    },
  });
}

export function remainingRouteFetches(used: number): number {
  return Math.max(0, FETCH_LIMIT - used);
}

export { FETCH_LIMIT };

function round(value: number): string {
  return value.toFixed(4);
}
