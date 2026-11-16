import { prisma } from "@/server/db";
import { fetchNearby } from "@/server/nearby/overpass";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return jsonError("Kos tidak ditemukan.", 404);
  if (listing.latitude == null || listing.longitude == null) {
    return jsonError("Pasang titik kos dulu sebelum menghitung fasilitas sekitar.");
  }
  const cached = await prisma.nearbySnapshot.findUnique({ where: { listingId: id } });
  const freshEnough = cached && Date.now() - cached.fetchedAt.getTime() < 1000 * 60 * 60 * 24 * 7;
  if (freshEnough && cached) {
    return Response.json({ report: JSON.parse(cached.payload), cached: true });
  }
  const report = await fetchNearby(listing.latitude, listing.longitude);
  if (!report) return jsonError("OpenStreetMap sedang tidak menjawab. Coba lagi nanti.", 503);
  await prisma.nearbySnapshot.upsert({
    where: { listingId: id },
    update: { payload: JSON.stringify(report), fetchedAt: new Date() },
    create: { listingId: id, payload: JSON.stringify(report) },
  });
  return Response.json({ report, cached: false });
}
