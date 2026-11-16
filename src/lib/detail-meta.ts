export type ListingRoomType = {
  name: string;
  sizeLabel: string | null;
  priceRaw: string | null;
  availability: string | null;
  facilities: string[];
};

export type ListingReview = {
  author: string;
  rating: number | null;
  ago: string | null;
  text: string;
};

export type ListingDetailMeta = {
  brandBadge?: string | null;
  ownerName?: string | null;
  ownerStatus?: string | null;
  ownerPhotoUrl?: string | null;
  availableRoomsCount?: number | null;
  sizeRaw?: string | null;
  specItems?: string[];
  roomFacilities?: string[];
  bathFacilities?: string[];
  sharedFacilities?: string[];
  parkingFacilities?: string[];
  rules?: string[];
  facilityNote?: string | null;
  ownerStory?: string | null;
  nearbyPois?: string[];
  roomTypes?: ListingRoomType[];
  originalPriceRaw?: string | null;
  discountLabel?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  ratingParts?: Array<{ label: string; score: number }>;
  transactionLabel?: string | null;
  refundNote?: string | null;
  reviews?: ListingReview[];
  /** Set after the Mamikos overview block (rating, aturan, landmark) has been read. */
  overviewCaptured?: boolean;
};

const PREFIX = "__KOSCOUT_META__:";

export function serializeDetailMeta(meta: ListingDetailMeta, fallbackText?: string | null): string {
  const payload = JSON.stringify(meta);
  return fallbackText ? `${PREFIX}${payload}\n${fallbackText}` : `${PREFIX}${payload}`;
}

export function parseDetailMeta(rawText: string | null | undefined): ListingDetailMeta | null {
  if (!rawText || !rawText.startsWith(PREFIX)) return null;
  const firstLine = rawText.slice(PREFIX.length).split("\n")[0];
  if (!firstLine) return null;
  try {
    const parsed = JSON.parse(firstLine) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ListingDetailMeta) : null;
  } catch {
    return null;
  }
}

export function deduplicateImages(urls: string[]): string[] {
  const seenKeys = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    if (!/^https:\/\//i.test(url)) continue;
    // Normalize Mamikos cache sizes like /9wnZ0LnH-240x320.jpg and /9wnZ0LnH-540x720.jpg
    const key = url
      .replace(/-\d+x\d+(?=\.[a-z]+(?:$|\?))/i, "")
      .replace(/\?.*$/, "")
      .toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    unique.push(url);
  }
  return unique;
}
