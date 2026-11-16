import { FACILITIES } from "@/lib/facilities";
import { overallScore, relativeScore, type Weights } from "@/server/scoring/weights";

export type ScoreInput = {
  id: string;
  priceAmount: number | null;
  durationSeconds: number | null;
  facilities: string[];
  nearbyScore: number | null;
  transportScore: number | null;
};

export type ScoreBreakdown = {
  price: number | null;
  commute: number | null;
  facilities: number | null;
  nearby: number | null;
  transport: number | null;
  overall: number | null;
};

export function scoreListings(listings: ScoreInput[], weights: Weights): Map<string, ScoreBreakdown> {
  const prices = listings.map((item) => item.priceAmount).filter((value): value is number => value != null);
  const minutes = listings
    .map((item) => (item.durationSeconds == null ? null : Math.max(1, Math.round(item.durationSeconds / 60))))
    .filter((value): value is number => value != null);

  const result = new Map<string, ScoreBreakdown>();
  for (const listing of listings) {
    const price = listing.priceAmount == null ? null : relativeScore(listing.priceAmount, prices, true);
    const commute =
      listing.durationSeconds == null
        ? null
        : relativeScore(Math.max(1, Math.round(listing.durationSeconds / 60)), minutes, true);
    const facilities = listing.facilities.length === 0 ? null : facilityScore(listing.facilities);
    const breakdown: ScoreBreakdown = {
      price,
      commute,
      facilities,
      nearby: listing.nearbyScore,
      transport: listing.transportScore,
      overall: null,
    };
    breakdown.overall = overallScore([
      { key: "price", score: breakdown.price, weight: weights.price },
      { key: "commute", score: breakdown.commute, weight: weights.commute },
      { key: "facilities", score: breakdown.facilities, weight: weights.facilities },
      { key: "nearby", score: breakdown.nearby, weight: weights.nearby },
      { key: "transport", score: breakdown.transport, weight: weights.transport },
    ]);
    result.set(listing.id, breakdown);
  }
  return result;
}

export function facilityScore(facilities: string[]): number {
  const known = new Set(facilities);
  const hits = FACILITIES.filter((item) => known.has(item.id)).length;
  return Math.round((hits / FACILITIES.length) * 100);
}
