import { destination } from "@/lib/geo";
import { prisma } from "@/server/db";
import { fetchOpenIsochrone, orsConfigured, type OrsPolygon } from "@/server/geospatial/ors";
import { fetchRoute, type RouteProfile } from "@/server/geospatial/routing";

const RAYS = 8;
const STEPS = 4;

export async function getIsochrone(input: {
  latitude: number;
  longitude: number;
  minutes: number;
  profile?: RouteProfile;
}): Promise<{ type: "Polygon"; coordinates: number[][][] } | null> {
  const profile = input.profile ?? "driving";
  const provider = orsConfigured() ? "ors" : "osrm";
  const cacheKey = `${provider}:${profile}:${input.latitude.toFixed(3)},${input.longitude.toFixed(3)}:${input.minutes}`;
  const cached = await prisma.isochroneCache.findUnique({ where: { cacheKey } });
  if (cached) {
    return JSON.parse(cached.geojson) as OrsPolygon;
  }

  const polygon = orsConfigured()
    ? await fetchOpenIsochrone(input.latitude, input.longitude, input.minutes, profile)
    : await probePolygon(input.latitude, input.longitude, input.minutes, profile);
  if (!polygon) return null;
  await prisma.isochroneCache.create({ data: { cacheKey, geojson: JSON.stringify(polygon) } });
  return polygon;
}

async function probePolygon(
  latitude: number,
  longitude: number,
  minutes: number,
  profile: RouteProfile,
): Promise<OrsPolygon | null> {
  const points: Array<[number, number]> = [];
  for (let index = 0; index < RAYS; index += 1) {
    const bearing = (360 / RAYS) * index;
    const point = await probe(latitude, longitude, bearing, minutes, profile);
    if (point) points.push(point);
  }
  if (points.length < 4) return null;
  points.push(points[0]);
  return { type: "Polygon", coordinates: [points] };
}

async function probe(
  latitude: number,
  longitude: number,
  bearing: number,
  minutes: number,
  profile: RouteProfile,
): Promise<[number, number] | null> {
  let low = 0.4;
  let high = 18;
  let best: [number, number] | null = null;
  for (let step = 0; step < STEPS; step += 1) {
    const distance = (low + high) / 2;
    const target = destination(latitude, longitude, distance, bearing);
    const route = await fetchRoute(
      { latitude, longitude },
      { latitude: target.latitude, longitude: target.longitude },
      profile,
      false,
    );
    if (!route) return best;
    if (route.durationSeconds / 60 <= minutes) {
      best = [target.longitude, target.latitude];
      low = distance;
    } else {
      high = distance;
    }
  }
  return best;
}
