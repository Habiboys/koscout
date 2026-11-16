import { fetchListingPage } from "@/server/import/fetch-listing-page";
import { readMamikosRoom } from "@/server/import/parse-mamikos";
import { parseRukitaSearch, readRukitaPlace, type RukitaCard, type RukitaPlace } from "@/server/import/parse-rukita";
import { fetchMamikosBandungRooms } from "@/server/import/refresh-listing";
import { prisma } from "@/server/db";
import { saveListing } from "@/server/listings";

export type ImportSearchResult = {
  source: ScrapeSourceId;
  total: number;
  created: number;
  updated: number;
  withPin: number;
};

export const SCRAPE_CITIES = [{ id: "bandung", label: "Bandung" }] as const;

export type ScrapeSourceId = "rukita" | "mamikos";

export type SourcePull = {
  source: ScrapeSourceId;
  ok: boolean;
  total: number;
  created: number;
  updated: number;
  withPin: number;
  message: string | null;
};

const RUKITA_CITY_PAGES: Record<(typeof SCRAPE_CITIES)[number]["id"], string> = {
  bandung: "https://www.rukita.co/kost/bandung",
};

export async function importSelectedSources(
  sources: ScrapeSourceId[],
  city: keyof typeof RUKITA_CITY_PAGES,
): Promise<SourcePull[]> {
  const pulls: SourcePull[] = [];
  for (const source of sources) {
    if (source === "rukita") {
      try {
        const result = await importSearchPage(RUKITA_CITY_PAGES[city]);
        pulls.push({ ...result, ok: true, message: null });
      } catch (error) {
        pulls.push(emptyPull("rukita", error instanceof Error ? error.message : "Rukita tidak bisa dibaca."));
      }
      continue;
    }
    try {
      const result = await importMamikosBandung();
      pulls.push({ ...result, ok: true, message: null });
    } catch (error) {
      pulls.push(emptyPull("mamikos", error instanceof Error ? error.message : "Mamikos tidak bisa dibaca."));
    }
  }
  return pulls;
}

function emptyPull(source: ScrapeSourceId, message: string): SourcePull {
  return { source, ok: false, total: 0, created: 0, updated: 0, withPin: 0, message };
}

export async function importMamikosBandung(): Promise<ImportSearchResult> {
  const rooms = await fetchMamikosBandungRooms();
  if (rooms.length === 0) {
    throw new Error("Daftar Mamikos tidak mengembalikan kos.");
  }
  const shareUrls = rooms
    .map((room) => (typeof room.share_url === "string" ? room.share_url : null))
    .filter((url): url is string => Boolean(url));

  const details = await mapPool(shareUrls, 4, async (url) => {
    try {
      const html = await fetchListingPage(url);
      return readMamikosRoom(html, url);
    } catch {
      return null;
    }
  });

  let created = 0;
  let updated = 0;
  let withPin = 0;
  for (const room of details) {
    if (!room) continue;
    const hasPin = room.latitude != null && room.longitude != null;
    if (hasPin) withPin += 1;
    const saved = await saveListing({
      name: room.name,
      sourceName: "mamikos",
      sourceUrl: room.sourceUrl,
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
    if (saved.updated) updated += 1;
    else created += 1;
  }

  return { source: "mamikos", total: details.filter(Boolean).length, created, updated, withPin };
}

export async function importSearchPage(url: string): Promise<ImportSearchResult> {
  const html = await fetchListingPage(url);
  const cards = parseRukitaSearch(html, url);
  if (cards.length === 0) {
    throw new Error(
      "Halaman terbuka, tetapi tidak ada kartu kos. Pakai halaman daftar kota, misalnya https://www.rukita.co/kost/bandung.",
    );
  }

  let created = 0;
  let updated = 0;
  let withPin = 0;
  const places = await mapPool(cards, 4, (card) => readPlace(card.sourceUrl));
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const place = places[index];
    if (!card || !place) continue;
    if (place.latitude != null && place.longitude != null) withPin += 1;
    const saved = await saveListing(toInput(card, place));
    await prisma.listing.update({
      where: { id: saved.record.id },
      data: {
        ...(place.roomSizeM2 != null ? { roomSizeM2: place.roomSizeM2 } : {}),
        ...(place.depositAmount != null ? { depositAmount: place.depositAmount } : {}),
        ...(place.electricityStatus !== "unknown" ? { electricityStatus: place.electricityStatus } : {}),
      },
    });
    if (saved.updated) updated += 1;
    else created += 1;
  }

  return { source: "rukita", total: cards.length, created, updated, withPin };
}

async function readPlace(url: string): Promise<RukitaPlace> {
  try {
    const html = await fetchListingPage(url);
    return readRukitaPlace(html);
  } catch {
    return {
      address: null,
      latitude: null,
      longitude: null,
      facilities: [],
      roomSizeM2: null,
      depositAmount: null,
      electricityStatus: "unknown",
      gender: "unknown",
      description: null,
      imageUrls: [],
      detailMeta: {},
      rawText: "",
    };
  }
}

function toInput(card: RukitaCard, place: RukitaPlace) {
  const hasPin = place.latitude != null && place.longitude != null;
  const address = place.address ?? [card.address, card.locality].filter(Boolean).join(", ");
  return {
    name: card.name,
    sourceName: "rukita",
    sourceUrl: card.sourceUrl,
    address: address || null,
    latitude: place.latitude,
    longitude: place.longitude,
    locationQuality: hasPin ? ("approximate" as const) : ("unknown" as const),
    gender: place.gender !== "unknown" ? place.gender : card.gender,
    priceAmount: card.priceAmount,
    priceRaw: card.priceRaw,
    pricePeriod: "month" as const,
    isStartingPrice: card.isStartingPrice,
    extraFeesNote: card.note,
    facilities: place.facilities,
    availability: "available" as const,
    description: place.description ?? [card.area, card.landmark].filter(Boolean).join(" · "),
    rawText: place.rawText || [card.name, address, card.priceRaw, card.area, card.landmark].filter(Boolean).join("\n"),
    imageUrls: place.imageUrls.length > 0 ? place.imageUrls : card.imageUrls,
  };
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}
