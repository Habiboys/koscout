import { prisma } from "@/server/db";
import type { NearbyReport } from "@/server/nearby/overpass";
import { scoreListings, type ScoreBreakdown } from "@/server/scoring/score";
import { suspiciousReasons } from "@/server/scoring/suspicious";
import { getWeights } from "@/server/settings";
import type { ListingWithCommute } from "@/server/listings";
import type { Weights } from "@/server/scoring/weights";

export async function enrichListings(listings: ListingWithCommute[]): Promise<{
  scores: Record<string, ScoreBreakdown>;
  warnings: Record<string, string[]>;
  nearby: Record<string, NearbyReport>;
  weights: Weights;
}> {
  const ids = listings.map((listing) => listing.id);
  const snaps = ids.length
    ? await prisma.nearbySnapshot.findMany({ where: { listingId: { in: ids } } })
    : [];
  const nearby: Record<string, NearbyReport> = {};
  for (const snap of snaps) {
    try {
      nearby[snap.listingId] = JSON.parse(snap.payload) as NearbyReport;
    } catch {
      continue;
    }
  }
  const weights = await getWeights();
  const scored = scoreListings(
    listings.map((listing) => ({
      id: listing.id,
      priceAmount: listing.priceAmount,
      durationSeconds: listing.durationSeconds,
      facilities: listing.facilities,
      nearbyScore: nearby[listing.id]?.nearbyScore ?? null,
      transportScore: nearby[listing.id]?.transportScore ?? null,
    })),
    weights,
  );
  const scores = Object.fromEntries(scored);
  const warnings = Object.fromEntries(listings.map((listing) => [listing.id, suspiciousReasons(listing, listings)]));
  return { scores, warnings, nearby, weights };
}
