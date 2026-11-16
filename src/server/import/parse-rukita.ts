import { deduplicateImages, serializeDetailMeta, type ListingDetailMeta, type ListingRoomType } from "@/lib/detail-meta";
import { parseFacilities, type FacilityId } from "@/lib/facilities";
import type { Gender } from "@/lib/labels";

export type RukitaCard = {
  name: string;
  sourceUrl: string;
  address: string | null;
  locality: string | null;
  gender: Gender;
  priceAmount: number | null;
  priceRaw: string | null;
  isStartingPrice: boolean;
  area: string | null;
  landmark: string | null;
  imageUrls: string[];
  note: string | null;
};

const CARD_LIMIT = 30;

export function parseRukitaSearch(html: string, pageUrl: string): RukitaCard[] {
  const origin = pageOrigin(pageUrl);
  if (!origin) return [];
  const cards: RukitaCard[] = [];
  for (const chunk of html.split('data-testid="AssetCard"').slice(1)) {
    const card = readCard(chunk, origin);
    if (!card) continue;
    cards.push(card);
    if (cards.length >= CARD_LIMIT) break;
  }
  return cards;
}

export type RukitaPlace = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  facilities: FacilityId[];
  roomSizeM2: number | null;
  depositAmount: number | null;
  electricityStatus: "included" | "excluded" | "unknown";
  gender: Gender;
  description: string | null;
  imageUrls: string[];
  detailMeta: ListingDetailMeta;
  rawText: string;
};

export function readRukitaPlace(html: string): RukitaPlace {
  const geo =
    html.match(/"latitude"\s*:\s*"(-?\d+(?:\.\d+)?)"\s*,\s*"longitude"\s*:\s*"(-?\d+(?:\.\d+)?)"/) ??
    html.match(/google\.com\/maps\/dir\/\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const latitude = geo ? Number(geo[1]) : null;
  const longitude = geo ? Number(geo[2]) : null;
  const listed = html.match(/meliputi\s+([^<".]{0,500})/i)?.[1] ?? "";
  const variantChunks = html.split('data-testid="AssetVariantItem"').slice(1);
  const firstVariant = variantChunks[0]?.slice(0, 35000) ?? "";
  const about = html.match(/data-testid="AssetAbout:Preview"[^>]*>([\s\S]{0,2500}?)<\/div>/i)?.[1];
  const variantText = decode(firstVariant.replace(/<[^>]+>/g, " "));
  const aboutText = clean(about?.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")) ?? null;
  const facilities = parseFacilities(`${decode(listed)} ${variantText} ${aboutText ?? ""}`);
  const size = variantText.match(/(\d+(?:[.,]\d+)?)\s*m²/i)?.[1];
  const deposit = html.match(/Deposit\s+sebesar\s+Rp\s*([\d.]+)/i)?.[1];
  const electric = /tidak termasuk listrik|termasuk listrik:\s*tidak/i.test(html)
    ? ("excluded" as const)
    : /termasuk listrik/i.test(html)
      ? ("included" as const)
      : ("unknown" as const);

  const addressMatch = html.match(/data-testid="AssetLocation"[\s\S]{0,2500}?<p class="line-clamp-2">([^<]+)<\/p>/i)?.[1];
  const sharedFacilities = uniqueStrings([
    ...decode(listed)
      .split(/,|dan\b/i)
      .map((item) => item.replace(/\.$/, "").trim()),
    ...[...html.matchAll(/data-testid="AssetDetailFacilities:AssetAttribute:[^"]+"[\s\S]{0,1500}?<div[^>]*>([^<]+)<\/div>/g)].map(
      (item) => decode(item[1] ?? ""),
    ),
  ]);

  const roomTypes: ListingRoomType[] = variantChunks.slice(0, 6).map((chunk) => {
    const slice = chunk.slice(0, 35000);
    const title = clean(slice.match(/<h3[^>]*>([^<]+)<\/h3>/i)?.[1]) ?? "Tipe Kamar";
    const vText = decode(slice.replace(/<[^>]+>/g, " "));
    const vSize = vText.match(/(\d+(?:[.,]\d+)?\s*m²)/i)?.[1] ?? null;
    const vPrice = clean(slice.match(/data-testid="AssetPriceDisplay:salePrice">([^<]+)</i)?.[1]);
    const avail = /Sedang penuh/i.test(slice) ? "Sedang penuh" : /Tersedia/i.test(slice) ? "Tersedia" : null;
    const items = [...slice.matchAll(/<li[^>]*>[\s\S]{0,1800}?<span[^>]*>([^<]+)<\/span>\s*<\/li>/g)].map((m) =>
      decode(m[1] ?? ""),
    );
    return {
      name: title,
      sizeLabel: vSize,
      priceRaw: vPrice ? `${vPrice}/bulan` : null,
      availability: avail,
      facilities: uniqueStrings(items),
    };
  });

  const roomFacilities = uniqueStrings(roomTypes.flatMap((rt) => rt.facilities));
  const rules = uniqueStrings([
    ...readRukitaRules(html),
    deposit ? `Deposit Rp${deposit}` : null,
    /Termasuk air/i.test(html) ? "Termasuk air" : null,
    electric === "excluded" ? "Tidak termasuk listrik" : electric === "included" ? "Termasuk listrik" : null,
  ]);
  const nearbyPois = readRukitaPois(html);

  const ownerSection = html.match(/data-testid="AssetManagementSection"([\s\S]{0,12000}?)<\/button>/i)?.[1] ?? "";
  const ownerLines = [...ownerSection.matchAll(/<p[^>]*>([^<]+)<\/p>/g)].map((m) => decode(m[1] ?? "")).filter(Boolean);
  const ownerName = ownerLines[1] ? `Pengelola: ${ownerLines[1]}` : ownerLines[0] ?? null;
  const ownerStatus = [ownerLines[2], ownerLines[0]].filter(Boolean).join(" · ") || null;

  const specItems = uniqueStrings([
    size ? `${size.replace(",", ".")} m²` : null,
    /Termasuk air/i.test(html) ? "Termasuk air" : null,
    electric === "excluded" ? "Tidak termasuk listrik" : electric === "included" ? "Termasuk listrik" : null,
    deposit ? `Deposit Rp${deposit}` : null,
  ]);

  const detailMeta: ListingDetailMeta = {
    brandBadge: /InfokostPro/i.test(html) ? "Infokost Pro" : /CompactUmaBadge/i.test(html) ? "Uma by Rukita" : "Rukita",
    ownerName,
    ownerStatus,
    sizeRaw: size ? `${size.replace(",", ".")} m²` : null,
    specItems,
    roomFacilities,
    sharedFacilities,
    rules,
    ownerStory: aboutText?.slice(0, 2000) ?? null,
    nearbyPois,
    roomTypes,
  };

  const genderLabel =
    html.match(/Coliving\s*[•·\-]?\s*(Putri|Putra|Campur)/i)?.[1] ??
    html.match(/\bKos(?:t)?\s+(Putri|Putra|Campur)\b/i)?.[1];

  return {
    address: clean(addressMatch),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    gender: genderOf(genderLabel),
    facilities,
    roomSizeM2: size ? Number(size.replace(",", ".")) : null,
    depositAmount: rupiah(deposit),
    electricityStatus: electric,
    description: aboutText?.slice(0, 1500) ?? null,
    imageUrls: images(html),
    detailMeta,
    rawText: serializeDetailMeta(detailMeta, aboutText),
  };
}

function readRukitaRules(html: string): string[] {
  const out: string[] = [];
  const rulesSection = html.match(/data-testid="AssetRulesSection"([\s\S]{0,6000}?)<\/section>/i)?.[1] ?? "";
  for (const div of rulesSection.split(/<div>/).slice(1)) {
    const ps = [...div.matchAll(/<p[^>]*>([^<]+)<\/p>/g)].map((m) => decode(m[1] ?? "")).filter(Boolean);
    if (ps.length >= 2) out.push(`${ps[0]}: ${ps[1]}`);
    else if (ps.length === 1) out.push(ps[0]);
  }
  const facts = html.match(/data-testid="AssetAttributeFacts"([\s\S]{0,2000}?)<\/section>/i)?.[1] ?? "";
  for (const li of facts.matchAll(/<li[^>]*>([^<]+)<\/li>/g)) {
    const text = decode(li[1] ?? "");
    if (text) out.push(text);
  }
  return out;
}

function readRukitaPois(html: string): string[] {
  const locIdx = html.indexOf('data-testid="AssetLocation"');
  if (locIdx < 0) return [];
  const chunk = html.slice(locIdx, locIdx + 14000);
  const pois: string[] = [];
  for (const match of chunk.matchAll(/<div class="flex flex-row items-center[^"]*">([^<]{4,90}?\d+(?:\.\d+)?\s*km)<\/div>/gi)) {
    const raw = decode(match[1] ?? "");
    const formatted = raw.replace(/(\d+(?:\.\d+)?\s*km)$/i, " ($1)");
    if (formatted) pois.push(formatted);
  }
  return uniqueStrings(pois).slice(0, 10);
}

function uniqueStrings(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item?.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function readCard(chunk: string, origin: string): RukitaCard | null {
  const href = chunk.match(/href="(\/place\/[^"#?]+)"/i)?.[1];
  const name = clean(chunk.match(/itemProp="name">([^<]+)</i)?.[1]);
  if (!href || !name) return null;
  const sourceUrl = new URL(href, origin).toString();
  const street = clean(chunk.match(/itemProp="streetAddress">([^<]+)</i)?.[1]);
  const locality = clean(chunk.match(/itemProp="addressLocality">([^<]+)</i)?.[1]);
  const priceRange = clean(chunk.match(/itemProp="priceRange">([^<]+)</i)?.[1]);
  const visible = decode(chunk.replace(/<[^>]+>/g, " "));
  const labeled = visible.match(/Coliving\s+•?\s*(Putri|Putra|Campur)/i)?.[1];
  const starting = visible.match(/mulai dari\s+Rp\s*([\d.]+)/i)?.[1];
  const priceAmount = rupiah(starting) ?? rupiah(priceRange);
  const area = visible.match(/\b([A-ZÀ-Ž][\p{L}.'’-]{1,30},\s*[A-ZÀ-Ž][\p{L}.'’-]{1,30})\b/u)?.[1] ?? null;
  const landmark = visible.match(/(\d+(?:[.,]\d+)?\s*(?:km|m)\s+dari\s+[^.]{3,80})/i)?.[1]?.trim() ?? null;
  const discount = /diskon sewa/i.test(visible) ? "Harga di kartu adalah harga mulai. Ada diskon untuk sewa yang lebih panjang." : null;
  return {
    name,
    sourceUrl,
    address: street,
    locality,
    gender: genderOf(labeled),
    priceAmount,
    priceRaw: starting ? `Rp${starting}` : priceRange,
    isStartingPrice: Boolean(starting || (priceRange && priceRange.includes("-"))),
    area,
    landmark,
    imageUrls: images(chunk),
    note: discount,
  };
}

function genderOf(value: string | undefined): Gender {
  const label = value?.toLowerCase();
  if (label === "putri" || label === "putra" || label === "campur") return label;
  return "unknown";
}

function images(chunk: string): string[] {
  const found: string[] = [];
  for (const match of chunk.matchAll(/https:\/\/images\.rukita\.co\/(?:ais|buildings\/building)\/[^"'?\s]+?\.(?:jpe?g|png|webp)/gi)) {
    found.push(match[0]);
  }
  return deduplicateImages(found).slice(0, 8);
}

function rupiah(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]{4,})/);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(".", ""));
  if (!Number.isInteger(amount) || amount < 100_000 || amount > 100_000_000) return null;
  return amount;
}

function clean(value: string | undefined): string | null {
  const text = decode(value ?? "");
  return text.length > 0 ? text : null;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pageOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
