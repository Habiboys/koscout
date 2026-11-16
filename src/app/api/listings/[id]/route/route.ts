import { prisma } from "@/server/db";
import { getActiveOffice } from "@/server/listings";
import { fetchRoute, getCachedRoute, rememberRoute, routeProviderName, type RouteProfile } from "@/server/geospatial/routing";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const profileParam = new URL(request.url).searchParams.get("profile");
  const profile: RouteProfile = profileParam === "foot" || profileParam === "bike" ? profileParam : "driving";
  const listing = await prisma.listing.findUnique({ where: { id } });
  const office = await getActiveOffice();
  if (!listing || listing.latitude == null || listing.longitude == null || !office) {
    return jsonError("Rute belum bisa dihitung.", 404);
  }
  const from = { latitude: office.latitude, longitude: office.longitude };
  const to = { latitude: listing.latitude, longitude: listing.longitude };
  const cached = await getCachedRoute(from, to, profile);
  if (cached?.geometry) {
    return Response.json({ ...cached, geometry: JSON.parse(cached.geometry) });
  }
  const route = await fetchRoute(from, to, profile, true);
  if (!route) return jsonError(`${routeProviderName()} tidak menjawab.`, 503);
  await rememberRoute(from, to, route, profile);
  return Response.json({
    ...route,
    geometry: route.geometry ? JSON.parse(route.geometry) : null,
  });
}
