import type { Listing, Office } from "@prisma/client";
import { facilityLabel } from "@/lib/facilities";
import { displayGender } from "@/lib/labels";
import { DEFAULT_FOCUS_KM } from "@/lib/geo";
import { matchesSource, sourceKey } from "@/lib/sources";
import { completenessScore } from "@/server/normalization/completeness";
import { prisma } from "@/server/db";
import { distanceKm } from "@/server/geospatial/distance";
import {
  FETCH_LIMIT,
  fetchDrivingRoute,
  getCachedRoute,
  rememberRoute,
} from "@/server/geospatial/routing";
import { knownFacilities, type ListingInput } from "@/lib/validations";
import { sanitizeUrl } from "@/server/normalization/parse-listing";

export type ListingRecord = {
  id: string;
  name: string;
  sourceName: string | null;
  sourceUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationQuality: string;
  gender: string;
  priceAmount: number | null;
  priceRaw: string | null;
  pricePeriod: string | null;
  isStartingPrice: boolean;
  extraFeesNote: string | null;
  facilities: string[];
  availability: string;
  description: string | null;
  rawText: string | null;
  completeness: number;
  roomSizeM2: number | null;
  depositAmount: number | null;
  adminFee: number | null;
  movingFee: number | null;
  electricityStatus: string;
  electricityMonthly: number | null;
  internetStatus: string;
  internetMonthly: number | null;
  laundryMonthly: number | null;
  otherMonthly: number | null;
  imageUrls: string[];
  lastCheckedAt: string;
};

export type RouteStatus = "ready" | "unavailable" | "limited" | "no-location" | "no-office";

export type ListingWithCommute = ListingRecord & {
  distanceKm: number | null;
  durationSeconds: number | null;
  routeStatus: RouteStatus;
  routeGeometry: { type: "LineString"; coordinates: number[][] } | null;
};

export type SearchFilters = {
  minBudget: number | null;
  maxBudget: number | null;
  salary: number | null;
  gender: Array<"putra" | "putri" | "campur">;
  facilities: string[];
  radiusKm: number | null;
  maxMinutes: number | null;
  source: string | null;
};

export type SearchResponse = {
  office: Office | null;
  matches: ListingWithCommute[];
  pendingCommute: ListingWithCommute[];
  excludedIncomplete: number;
  outsideArea: number;
  focusKm: number | null;
  radiusIgnored: boolean;
};

export function toRecord(listing: Listing): ListingRecord {
  return {
    id: listing.id,
    name: listing.name,
    sourceName: listing.sourceName,
    sourceUrl: listing.sourceUrl,
    address: listing.address,
    latitude: listing.latitude,
    longitude: listing.longitude,
    locationQuality: listing.locationQuality,
    gender: listing.gender,
    priceAmount: listing.priceAmount,
    priceRaw: listing.priceRaw,
    pricePeriod: listing.pricePeriod,
    isStartingPrice: listing.isStartingPrice,
    extraFeesNote: listing.extraFeesNote,
    facilities: readFacilities(listing.facilities),
    availability: listing.availability,
    description: listing.description,
    rawText: listing.rawText,
    completeness: listing.completeness,
    roomSizeM2: listing.roomSizeM2,
    depositAmount: listing.depositAmount,
    adminFee: listing.adminFee,
    movingFee: listing.movingFee,
    electricityStatus: listing.electricityStatus,
    electricityMonthly: listing.electricityMonthly,
    internetStatus: listing.internetStatus,
    internetMonthly: listing.internetMonthly,
    laundryMonthly: listing.laundryMonthly,
    otherMonthly: listing.otherMonthly,
    imageUrls: readFacilities(listing.imageUrls),
    lastCheckedAt: listing.lastCheckedAt.toISOString(),
  };
}

export function readFacilities(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function getActiveOffice(): Promise<Office | null> {
  return prisma.office.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveOffice(input: {
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
}): Promise<Office> {
  const existing = await getActiveOffice();
  if (!existing) {
    return prisma.office.create({
      data: {
        name: input.name,
        address: input.address ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        isActive: true,
      },
    });
  }
  return prisma.office.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      address: input.address ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });
}

export async function listRecords(): Promise<ListingRecord[]> {
  const rows = await prisma.listing.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(toRecord);
}

export async function getListing(id: string): Promise<ListingRecord | null> {
  const row = await prisma.listing.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

export async function getListingsByIds(ids: string[]): Promise<ListingRecord[]> {
  const unique = [...new Set(ids)].slice(0, 10);
  if (unique.length === 0) return [];
  const rows = await prisma.listing.findMany({ where: { id: { in: unique } } });
  const records = rows.map(toRecord);
  const order = new Map(unique.map((id, index) => [id, index]));
  records.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return records;
}

export function normalizeListingInput(input: ListingInput) {
  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;
  const hasCoords = latitude != null && longitude != null;
  let locationQuality = input.locationQuality;
  if (!hasCoords) locationQuality = "unknown";
  else if (locationQuality === "unknown") locationQuality = "approximate";

  const facilities = knownFacilities(input.facilities);
  const sourceUrl = sanitizeUrl(input.sourceUrl);
  const completeness = completenessScore({
    name: input.name,
    priceAmount: input.priceAmount,
    latitude,
    longitude,
    gender: input.gender,
    facilities,
    address: input.address,
  });

  return {
    name: input.name,
    sourceName: input.sourceName?.trim() || sourceNameFromUrl(sourceUrl),
    sourceUrl,
    address: emptyToNull(input.address),
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    locationQuality,
    gender: input.gender,
    priceAmount: input.priceAmount ?? null,
    priceRaw: emptyToNull(input.priceRaw),
    pricePeriod: input.pricePeriod ?? null,
    isStartingPrice: input.isStartingPrice ?? false,
    extraFeesNote: emptyToNull(input.extraFeesNote),
    facilities: JSON.stringify(facilities),
    availability: input.availability,
    description: emptyToNull(input.description),
    rawText: input.rawText ?? null,
    completeness,
    lastCheckedAt: new Date(),
    ...(input.imageUrls ? { imageUrls: JSON.stringify(collectSavedImages(input.imageUrls)) } : {}),
  };
}

function collectSavedImages(urls: string[]): string[] {
  const saved: string[] = [];
  for (const url of urls) {
    const clean = sanitizeUrl(url);
    if (!clean || saved.includes(clean)) continue;
    saved.push(clean);
    if (saved.length >= 8) break;
  }
  return saved;
}

export async function saveListing(input: ListingInput): Promise<{ record: ListingRecord; updated: boolean }> {
  const data = normalizeListingInput(input);
  if (data.sourceUrl) {
    const existing = await prisma.listing.findUnique({ where: { sourceUrl: data.sourceUrl } });
    if (existing) {
      const listing = await prisma.listing.update({ where: { id: existing.id }, data });
      await trackPrice(existing.id, existing.priceAmount, listing.priceAmount);
      return { record: toRecord(listing), updated: true };
    }
  }
  const listing = await prisma.listing.create({ data });
  await trackPrice(listing.id, null, listing.priceAmount);
  return { record: toRecord(listing), updated: false };
}

export async function updateListing(id: string, input: ListingInput): Promise<ListingRecord | null> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) return null;
  const data = normalizeListingInput(input);
  if (data.sourceUrl) {
    const clash = await prisma.listing.findUnique({ where: { sourceUrl: data.sourceUrl } });
    if (clash && clash.id !== id) {
      data.sourceUrl = existing.sourceUrl;
    }
  }
  const listing = await prisma.listing.update({ where: { id }, data });
  await trackPrice(id, existing.priceAmount, listing.priceAmount);
  return toRecord(listing);
}

async function trackPrice(listingId: string, before: number | null, after: number | null) {
  if (after == null || after === before) return;
  await prisma.priceHistory.create({ data: { listingId, amount: after } });
}

export async function listOffices() {
  return prisma.office.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createOffice(input: {
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
}): Promise<Office> {
  const count = await prisma.office.count();
  return prisma.office.create({
    data: {
      name: input.name,
      address: input.address ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      isActive: count === 0,
    },
  });
}

export async function activateOffice(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.office.updateMany({ data: { isActive: false } }),
    prisma.office.update({ where: { id }, data: { isActive: true } }),
  ]);
}

export async function searchListings(filters: SearchFilters): Promise<SearchResponse> {
  const office = await getActiveOffice();
  const listings = await listRecords();
  let excludedIncomplete = 0;
  let outsideArea = 0;
  const radiusIgnored = filters.radiusKm != null && !office;
  const focusKm = office ? (filters.radiusKm ?? DEFAULT_FOCUS_KM) : null;
  const passed: ListingRecord[] = [];

  for (const listing of listings) {
    if (filters.minBudget != null && (listing.priceAmount == null || listing.priceAmount < filters.minBudget)) {
      if (listing.priceAmount == null) excludedIncomplete += 1;
      continue;
    }
    if (filters.maxBudget != null && (listing.priceAmount == null || listing.priceAmount > filters.maxBudget)) {
      if (listing.priceAmount == null) excludedIncomplete += 1;
      continue;
    }
    if (filters.gender.length > 0) {
      const gender = displayGender(listing.gender, listing.name, listing.sourceUrl, listing.description);
      if (!filters.gender.some((item) => item === gender)) {
        if (gender === "unknown") excludedIncomplete += 1;
        continue;
      }
    }
    if (filters.facilities.length > 0) {
      const hasAll = filters.facilities.every((id) => listing.facilities.includes(id));
      if (!hasAll) continue;
    }
    if (!matchesSource(filters.source, listing.sourceName, listing.sourceUrl)) continue;
    if (focusKm != null && office) {
      if (listing.latitude == null || listing.longitude == null) {
        excludedIncomplete += 1;
        continue;
      }
      const km = distanceKm(office, { latitude: listing.latitude, longitude: listing.longitude });
      if (km > focusKm) {
        outsideArea += 1;
        continue;
      }
    }
    passed.push(listing);
  }

  const withRoutes = await attachCommute(passed, office);
  if (filters.maxMinutes == null) {
    return {
      office,
      matches: withRoutes,
      pendingCommute: [],
      excludedIncomplete,
      outsideArea,
      focusKm,
      radiusIgnored,
    };
  }

  const matches: ListingWithCommute[] = [];
  const pendingCommute: ListingWithCommute[] = [];
  for (const item of withRoutes) {
    if (item.durationSeconds == null) {
      pendingCommute.push(item);
      continue;
    }
    const minutes = Math.max(1, Math.round(item.durationSeconds / 60));
    if (minutes <= filters.maxMinutes) {
      matches.push(item);
    }
  }

  return { office, matches, pendingCommute, excludedIncomplete, outsideArea, focusKm, radiusIgnored };
}

export async function attachCommute(
  listings: ListingRecord[],
  office: Office | null,
): Promise<ListingWithCommute[]> {
  const ranked = listings
    .map((listing) => {
      if (!office || listing.latitude == null || listing.longitude == null) {
        return { listing, distance: Number.POSITIVE_INFINITY, km: null as number | null };
      }
      const km = distanceKm(office, { latitude: listing.latitude, longitude: listing.longitude });
      return { listing, distance: km, km };
    })
    .sort((a, b) => a.distance - b.distance);

  const byId = new Map<string, ListingWithCommute>();
  const queue: Array<{
    listing: ListingRecord;
    km: number;
    from: { latitude: number; longitude: number };
    to: { latitude: number; longitude: number };
  }> = [];

  for (const item of ranked) {
    const { listing } = item;
    if (listing.latitude == null || listing.longitude == null) {
      byId.set(listing.id, commute(listing, null, null, "no-location"));
      continue;
    }
    if (!office) {
      byId.set(listing.id, commute(listing, null, null, "no-office"));
      continue;
    }

    const from = { latitude: office.latitude, longitude: office.longitude };
    const to = { latitude: listing.latitude, longitude: listing.longitude };
    const cached = await getCachedRoute(from, to);
    if (cached) {
      byId.set(listing.id, commute(listing, roadKm(cached.distanceMeters), cached.durationSeconds, "ready", cached.geometry));
      continue;
    }
    if (queue.length >= FETCH_LIMIT) {
      byId.set(listing.id, commute(listing, item.km, null, "limited"));
      continue;
    }
    queue.push({ listing, km: item.km ?? 0, from, to });
  }

  for (let index = 0; index < queue.length; index += 4) {
    const batch = queue.slice(index, index + 4);
    const results = await Promise.all(
      batch.map(async (item) => ({ item, route: await fetchDrivingRoute(item.from, item.to) })),
    );
    for (const { item, route } of results) {
      if (!route) {
        byId.set(item.listing.id, commute(item.listing, item.km, null, "unavailable"));
        continue;
      }
      await rememberRoute(item.from, item.to, route);
      byId.set(
        item.listing.id,
        commute(item.listing, roadKm(route.distanceMeters), route.durationSeconds, "ready", route.geometry),
      );
    }
  }

  return listings.map((listing) => byId.get(listing.id)!);
}

export function facilityLabels(ids: string[]): string[] {
  return ids.map(facilityLabel);
}

function commute(
  listing: ListingRecord,
  distanceKm: number | null,
  durationSeconds: number | null,
  routeStatus: RouteStatus,
  geometry: string | null = null,
): ListingWithCommute {
  return { ...listing, distanceKm, durationSeconds, routeStatus, routeGeometry: lineGeometry(geometry) };
}

function roadKm(meters: number): number {
  return Math.round((meters / 1000) * 100) / 100;
}

function lineGeometry(raw: string | null): ListingWithCommute["routeGeometry"] {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { type?: string; coordinates?: number[][] };
    if (value.type === "LineString" && Array.isArray(value.coordinates)) {
      return { type: "LineString", coordinates: value.coordinates };
    }
  } catch {
    return null;
  }
  return null;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sourceNameFromUrl(url: string | null): string {
  return sourceKey(null, url);
}
