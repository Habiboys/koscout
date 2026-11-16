import { geocodeAddress } from "@/server/geospatial/geocoding";
import { importSearchPage } from "@/server/import/import-search";
import { parseMamikosCards, readMamikosRoom, type CapturedCard, type MamikosCard } from "@/server/import/parse-mamikos";
import { parseRukitaSearch, readRukitaPlace } from "@/server/import/parse-rukita";
import { prisma } from "@/server/db";
import { getActiveOffice, saveListing } from "@/server/listings";

export type CaptureInput = {
  sourceUrl: string;
  title: string;
  cards: CapturedCard[];
  pageHtml?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CaptureResult = {
  source: string;
  total: number;
  created: number;
  updated: number;
  withPin: number;
};

export async function importCapturedPage(input: CaptureInput): Promise<CaptureResult> {
  const host = hostname(input.sourceUrl);
  const path = pathname(input.sourceUrl);
  if (host === "rukita.co" && path.startsWith("/place/") && input.pageHtml) {
    return saveRukitaPlacePage(input.sourceUrl, input.title, input.pageHtml);
  }
  if (host === "rukita.co") {
    const html = input.cards.map((card) => card.html).join("\n");
    if (parseRukitaSearch(html, input.sourceUrl).length === 0) {
      throw new Error("Kartu Rukita tidak ketemu di halaman ini. Buka daftar kota, misalnya kost Bandung.");
    }
    const saved = await importSearchPage(input.sourceUrl);
    return saved;
  }
  if (host === "mamikos.com" && path.startsWith("/room/") && input.pageHtml) {
    return saveMamikosRoomPage(input.sourceUrl, input.pageHtml);
  }
  if (host === "mamikos.com") {
    return saveMamikos(input);
  }
  throw new Error("Situs ini belum dikenal. Ekstensi sekarang mengirim Rukita dan Mamikos.");
}

async function saveMamikos(input: CaptureInput): Promise<CaptureResult> {
  const cards = parseMamikosCards(input.cards);
  if (cards.length === 0) {
    throw new Error("Kartu Mamikos tidak ketemu. Buka halaman hasil sampai daftar kosnya tampil, lalu ambil lagi.");
  }
  const office = await getActiveOffice();
  const city = cityFrom(input.sourceUrl, input.title, office);
  const pins = new Map<string, { latitude: number; longitude: number }>();
  let created = 0;
  let updated = 0;
  let withPin = 0;
  for (const card of cards) {
    const query = [card.area, city].filter(Boolean).join(", ");
    const pin = query.length >= 3 ? await pinFor(pins, query) : null;
    if (pin) withPin += 1;
    const saved = await saveMamikosCard(card, pin, city);
    if (saved) updated += 1;
    else created += 1;
  }
  return { source: "mamikos", total: cards.length, created, updated, withPin };
}

async function saveMamikosCard(
  card: MamikosCard,
  pin: { latitude: number; longitude: number } | null,
  city: string | null,
): Promise<boolean> {
  const data = {
    name: card.name,
    sourceName: "mamikos",
    sourceUrl: card.sourceUrl,
    address: [card.area, city].filter(Boolean).join(", ") || null,
    latitude: pin?.latitude ?? null,
    longitude: pin?.longitude ?? null,
    locationQuality: pin ? ("approximate" as const) : ("unknown" as const),
    gender: card.gender,
    priceAmount: card.priceAmount,
    priceRaw: card.priceRaw,
    pricePeriod: "month" as const,
    isStartingPrice: card.isStartingPrice,
    extraFeesNote: card.note,
    facilities: card.facilities,
    availability: "available" as const,
    description: "Dibaca dari halaman Mamikos yang sedang terbuka.",
    rawText: card.rawText,
    imageUrls: card.imageUrls,
  };
  if (card.sourceUrl) {
    const saved = await saveListing(data);
    return saved.updated;
  }
  const existing = await prisma.listing.findFirst({ where: { name: card.name, sourceName: "mamikos" } });
  if (!existing) {
    await saveListing(data);
    return false;
  }
  await prisma.listing.update({
    where: { id: existing.id },
    data: {
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      locationQuality: data.locationQuality,
      gender: data.gender,
      priceAmount: data.priceAmount,
      priceRaw: data.priceRaw,
      isStartingPrice: data.isStartingPrice,
      extraFeesNote: data.extraFeesNote,
      facilities: JSON.stringify(data.facilities),
      imageUrls: JSON.stringify(data.imageUrls),
      rawText: data.rawText,
      lastCheckedAt: new Date(),
    },
  });
  return true;
}

async function pinFor(cache: Map<string, { latitude: number; longitude: number }>, query: string) {
  const key = query.toLowerCase();
  const known = cache.get(key);
  if (known) return known;
  const hit = await geocodeAddress(query);
  if (!hit) return null;
  const pin = { latitude: hit.latitude, longitude: hit.longitude };
  cache.set(key, pin);
  return pin;
}

function cityFrom(
  url: string,
  title: string,
  office: { latitude: number; longitude: number; address: string | null } | null,
): string | null {
  const text = `${url} ${title} ${office?.address ?? ""}`.toLowerCase();
  if (text.includes("bandung") || /\bupi\b|itb|unpad|telkom/.test(text)) return "Bandung";
  if (text.includes("jakarta")) return "Jakarta";
  if (text.includes("yogyakarta") || text.includes("jogja")) return "Yogyakarta";
  if (text.includes("surabaya")) return "Surabaya";
  if (office && office.latitude < -6.7 && office.latitude > -7.1 && office.longitude > 107.4 && office.longitude < 107.8) {
    return "Bandung";
  }
  if (office && office.latitude < -6.0 && office.latitude > -6.5 && office.longitude > 106.6 && office.longitude < 107.0) {
    return "Jakarta";
  }
  return null;
}

function hostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function pathname(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

async function saveMamikosRoomPage(url: string, html: string): Promise<CaptureResult> {
  const room = readMamikosRoom(html, url);
  if (!room) throw new Error("Detail kos Mamikos tidak terbaca dari halaman ini.");
  const hasPin = room.latitude != null && room.longitude != null;
  const saved = await saveListing({
    name: room.name,
    sourceName: "mamikos",
    sourceUrl: room.sourceUrl ?? url,
    address: room.address,
    latitude: room.latitude,
    longitude: room.longitude,
    locationQuality: hasPin ? "approximate" : "unknown",
    gender: room.gender,
    priceAmount: room.priceAmount,
    priceRaw: room.priceRaw,
    pricePeriod: "month",
    isStartingPrice: false,
    extraFeesNote: room.extraFeesNote,
    facilities: room.facilities,
    availability: room.availability,
    description: room.description,
    rawText: room.rawText,
    imageUrls: room.imageUrls,
  });
  await prisma.listing.update({
    where: { id: saved.record.id },
    data: {
      ...(room.roomSizeM2 != null ? { roomSizeM2: room.roomSizeM2 } : {}),
      ...(room.electricityStatus !== "unknown" ? { electricityStatus: room.electricityStatus } : {}),
    },
  });
  return { source: "mamikos", total: 1, created: saved.updated ? 0 : 1, updated: saved.updated ? 1 : 0, withPin: hasPin ? 1 : 0 };
}

async function saveRukitaPlacePage(url: string, title: string, html: string): Promise<CaptureResult> {
  const place = readRukitaPlace(html);
  const name = title.split("|")[0]?.trim() || "Kost Rukita";
  const hasPin = place.latitude != null && place.longitude != null;
  const saved = await saveListing({
    name,
    sourceName: "rukita",
    sourceUrl: url,
    address: null,
    latitude: place.latitude,
    longitude: place.longitude,
    locationQuality: hasPin ? "approximate" : "unknown",
    gender: place.gender,
    priceAmount: null,
    priceRaw: null,
    pricePeriod: "month",
    isStartingPrice: true,
    extraFeesNote: null,
    facilities: place.facilities,
    availability: "available",
    description: place.description,
    rawText: place.rawText,
    imageUrls: place.imageUrls,
  });
  await prisma.listing.update({
    where: { id: saved.record.id },
    data: {
      ...(place.roomSizeM2 != null ? { roomSizeM2: place.roomSizeM2 } : {}),
      ...(place.depositAmount != null ? { depositAmount: place.depositAmount } : {}),
      ...(place.electricityStatus !== "unknown" ? { electricityStatus: place.electricityStatus } : {}),
    },
  });
  return { source: "rukita", total: 1, created: saved.updated ? 0 : 1, updated: saved.updated ? 1 : 0, withPin: hasPin ? 1 : 0 };
}
