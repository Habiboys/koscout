import { parseFacilities } from "@/lib/facilities";
import { sourceKey } from "@/lib/sources";
import type { Availability, Gender, LocationQuality, PricePeriod } from "@/lib/labels";
import { completenessScore } from "@/server/normalization/completeness";
import { parseAvailability, parseGender } from "@/server/normalization/normalize-facilities";
import { parsePrice } from "@/server/normalization/normalize-price";

export type ParsedListing = {
  name: string;
  sourceName: string | null;
  sourceUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationQuality: LocationQuality;
  gender: Gender;
  priceAmount: number | null;
  priceRaw: string | null;
  pricePeriod: PricePeriod | null;
  isStartingPrice: boolean;
  extraFeesNote: string | null;
  estimateNote: string | null;
  facilities: string[];
  availability: Availability;
  description: string | null;
  rawText: string;
  imageUrls: string[];
  completeness: number;
};

export function parseListing(text: string): ParsedListing {
  const json = readJson(text);
  const body = json?.body ?? text;
  const price = parsePrice(body);
  const sourceUrl = sanitizeUrl(readString(json?.payload.sourceUrl) ?? guessUrl(body));
  const name = cleanName(readString(json?.payload.name) ?? guessName(body));
  const address = cleanLine(readString(json?.payload.address) ?? guessAddress(body));
  const facilities = parseFacilities(body);
  const gender = parseGender(body);
  const availability = parseAvailability(body);
  const description = body.trim().slice(0, 500) || null;

  const draft = {
    name,
    sourceName: sourceNameFromUrl(sourceUrl),
    sourceUrl,
    address,
    latitude: null,
    longitude: null,
    locationQuality: "unknown" as const,
    gender,
    priceAmount: price.priceAmount,
    priceRaw: price.priceRaw,
    pricePeriod: price.pricePeriod,
    isStartingPrice: price.isStartingPrice,
    extraFeesNote: price.extraFeesNote,
    estimateNote: price.estimateNote,
    facilities,
    availability,
    description,
    rawText: body.slice(0, 20000),
    imageUrls: collectImageUrls(json?.payload.imageUrls, body),
    completeness: 0,
  };

  return {
    ...draft,
    completeness: completenessScore(draft),
  };
}

export function sanitizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString().slice(0, 2000);
  } catch {
    return null;
  }
}

function readJson(text: string): { payload: Record<string, unknown>; body: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    if (!payload || Array.isArray(payload)) return null;
    const rawText = readString(payload.rawText);
    return { payload, body: rawText ?? trimmed };
  } catch {
    return null;
  }
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function guessName(text: string): string {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.length < 3 || line.length > 90) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/^rp\b/i.test(line)) continue;
    if (/^fasilitas\b/i.test(line)) continue;
    return line;
  }
  return "Kos tanpa nama";
}

function guessAddress(text: string): string | null {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find(
      (line) =>
        /\b(jl\.?|jalan|gg\.?|gang|kav\.?|no\.)\b/i.test(line) ||
        /\b(jakarta|bandung|depok|tangerang|bekasi|bogor|surabaya|yogyakarta)\b/i.test(line),
    ) ?? null
  );
}

function guessUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  return match.find((url) => !isImageUrl(url)) ?? match[0] ?? null;
}

export function collectImageUrls(value: unknown, text: string): string[] {
  const listed = Array.isArray(value) ? value : [];
  const found = [...listed, ...(text.match(/https?:\/\/[^\s)"']+/gi) ?? [])];
  const urls: string[] = [];
  for (const item of found) {
    const url = sanitizeUrl(typeof item === "string" ? item.replace(/[),.;]+$/, "") : null);
    if (!url || !isImageUrl(url) || urls.includes(url)) continue;
    urls.push(url);
    if (urls.length >= 8) break;
  }
  return urls;
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url) || /\/(images?|photos?|uploads?|gallery)\//i.test(url);
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200) || "Kos tanpa nama";
}

function cleanLine(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 500);
  return cleaned || null;
}

function sourceNameFromUrl(url: string | null): string | null {
  return sourceKey(null, url);
}
