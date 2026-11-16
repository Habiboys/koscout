import { z } from "zod";
import { isFacilityId } from "@/lib/facilities";

export const listingInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sourceName: z.string().trim().max(120).nullable().optional(),
  sourceUrl: z.string().trim().max(2000).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  latitude: z.number().gte(-90).lte(90).nullable().optional(),
  longitude: z.number().gte(-180).lte(180).nullable().optional(),
  locationQuality: z.enum(["exact", "approximate", "unknown"]),
  gender: z.enum(["putra", "putri", "campur", "unknown"]),
  priceAmount: z.number().int().positive().max(100_000_000).nullable().optional(),
  priceRaw: z.string().max(120).nullable().optional(),
  pricePeriod: z.enum(["day", "month", "year", "unknown"]).nullable().optional(),
  isStartingPrice: z.boolean().optional(),
  extraFeesNote: z.string().max(1000).nullable().optional(),
  facilities: z.array(z.string()).max(20),
  availability: z.enum(["available", "full", "unknown"]),
  description: z.string().max(2000).nullable().optional(),
  rawText: z.string().max(20000).nullable().optional(),
  imageUrls: z.array(z.string().max(2000)).max(8).optional(),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

export const officeInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(500).nullable().optional(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export const parseTextSchema = z.object({
  text: z.string().max(20000),
});

export const geocodeSchema = z.object({
  query: z.string().trim().min(3).max(300),
});

export function knownFacilities(ids: string[]): string[] {
  return [...new Set(ids.filter(isFacilityId))];
}
