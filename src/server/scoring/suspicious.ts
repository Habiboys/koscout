import { distanceKm } from "@/server/geospatial/distance";

export type PricePeer = {
  id: string;
  priceAmount: number | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  rawText: string | null;
};

export function suspiciousReasons(
  listing: PricePeer,
  peers: PricePeer[],
): string[] {
  const reasons: string[] = [];
  if (!listing.description?.trim() && !listing.rawText?.trim()) {
    reasons.push("Deskripsi kosong");
  }
  if (listing.priceAmount == null || listing.latitude == null || listing.longitude == null) {
    return reasons;
  }
  const nearby = peers.filter((peer) => {
    if (peer.id === listing.id || peer.priceAmount == null || peer.latitude == null || peer.longitude == null) {
      return false;
    }
    return distanceKm(listing as { latitude: number; longitude: number }, peer as { latitude: number; longitude: number }) <= 3;
  });
  if (nearby.length < 3) return reasons;
  const median = medianOf(nearby.map((peer) => peer.priceAmount as number));
  if (listing.priceAmount < median * 0.6) {
    reasons.push("Harga jauh di bawah median kos sekitar 3 km");
  }
  return reasons;
}

export function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}
