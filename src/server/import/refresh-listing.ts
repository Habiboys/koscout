import { createDecipheriv } from "node:crypto";
import { prisma } from "@/server/db";
import { fetchListingPage } from "@/server/import/fetch-listing-page";
import { readMamikosDetailId, readMamikosRoom } from "@/server/import/parse-mamikos";
import { readRukitaPlace } from "@/server/import/parse-rukita";
import { getListing } from "@/server/listings";

const MAMI_KEY = Buffer.from(
  Buffer.from("MzljODUyZDBkMGJjNDJlZjgzZjdkM2Q3MDhmNDIzNjg=", "base64").toString("utf8"),
  "utf8",
);
const MAMI_IV = Buffer.from(Buffer.from("NWRmNWExMGViYjAzNTA5Nw==", "base64").toString("utf8"), "utf8");

export function decryptMamikosRooms(cipherText: string): Array<Record<string, unknown>> {
  const decipher = createDecipheriv("aes-256-cbc", MAMI_KEY, MAMI_IV);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherText, "base64")), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as Array<Record<string, unknown>>;
}

const MAMIKOS_PAGE = 20;

export async function fetchMamikosBandungRooms(): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let offset = 0;
  for (;;) {
    const response = await fetch("https://mamikos.com/garuda/stories/list?v=2&with_thematic_badge=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://mamikos.com/cari/upi/all/bulanan/0-15000000",
        "X-Git-Time": "1406090202",
      },
      body: JSON.stringify({
        filters: {
          gender: [0, 1, 2],
          price_range: [0, 15000000],
          tag_ids: [],
          rent_type: 2,
          property_type: "kost",
          random_seeds: 412,
          flash_sale: false,
          goldplus: [],
          kost_levels: [],
          is_expand: false,
          is_available: false,
        },
        sorting: { field: "price", direction: "-" },
        is_for_map: false,
        geocode_id: null,
        location: [
          [107.571, -6.881],
          [107.611, -6.841],
        ],
        point: { latitude: -6.86093, longitude: 107.591 },
        include_promoted: true,
        limit: MAMIKOS_PAGE,
        offset,
      }),
    });
    if (!response.ok) break;
    const body = (await response.json()) as { rooms?: string };
    if (!body.rooms) break;
    const page = decryptMamikosRooms(body.rooms);
    if (page.length === 0) break;
    let added = 0;
    for (const room of page) {
      const shareUrl = typeof room.share_url === "string" ? room.share_url : null;
      if (!shareUrl || seen.has(shareUrl)) continue;
      seen.add(shareUrl);
      out.push(room);
      added += 1;
    }
    if (added === 0 || page.length < MAMIKOS_PAGE) break;
    offset += MAMIKOS_PAGE;
  }
  return out;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(kost|kos|apik|singgahsini|andalan|bandung|kota|barat|kecamatan)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolveMamikosUrl(name: string): Promise<string | null> {
  const target = normalizeTitle(name);
  const rooms = await fetchMamikosBandungRooms();
  const exact = rooms.find((room) => {
    const title = typeof room["room-title"] === "string" ? room["room-title"] : "";
    return normalizeTitle(title) === target;
  });
  if (exact && typeof exact.share_url === "string") return exact.share_url;
  for (const room of rooms) {
    const title = typeof room["room-title"] === "string" ? room["room-title"] : "";
    const shareUrl = typeof room.share_url === "string" ? room.share_url : null;
    if (!shareUrl) continue;
    const candidate = normalizeTitle(title);
    if (candidate.includes(target) || target.includes(candidate)) {
      return shareUrl;
    }
  }
  return null;
}

export async function refreshListingFromSource(id: string) {
  const listing = await getListing(id);
  if (!listing) throw new Error("Kos tidak ditemukan.");

  let sourceUrl = listing.sourceUrl;
  if (!sourceUrl && listing.sourceName === "mamikos") {
    sourceUrl = await resolveMamikosUrl(listing.name);
  }
  if (!sourceUrl) throw new Error("Kos ini belum punya tautan situs asli.");

  const html = await fetchListingPage(sourceUrl);
  const story = await fetchMamikosStory(html);
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  if (host === "rukita.co") {
    const place = readRukitaPlace(html);
    await prisma.listing.update({
      where: { id },
      data: {
        ...(place.address ? { address: place.address } : {}),
        ...(place.latitude != null && place.longitude != null
          ? { latitude: place.latitude, longitude: place.longitude, locationQuality: "approximate" }
          : {}),
        ...(place.facilities.length > 0 ? { facilities: JSON.stringify(place.facilities) } : {}),
        ...(place.roomSizeM2 != null ? { roomSizeM2: place.roomSizeM2 } : {}),
        ...(place.depositAmount != null ? { depositAmount: place.depositAmount } : {}),
        ...(place.gender !== "unknown" ? { gender: place.gender } : {}),
        ...(place.electricityStatus !== "unknown" ? { electricityStatus: place.electricityStatus } : {}),
        ...(place.description ? { description: place.description } : {}),
        ...(place.imageUrls.length > 0 ? { imageUrls: JSON.stringify(place.imageUrls) } : {}),
        rawText: place.rawText,
        lastCheckedAt: new Date(),
      },
    });
    return getListing(id);
  }

  if (host === "mamikos.com") {
    const room = readMamikosRoom(html, sourceUrl, story);
    if (!room) throw new Error("Detail Mamikos tidak bisa dibaca dari halaman ini.");
    const nextUrl = listing.sourceUrl ?? room.sourceUrl ?? sourceUrl;
    const conflict = nextUrl
      ? await prisma.listing.findFirst({ where: { sourceUrl: nextUrl, NOT: { id } }, select: { id: true } })
      : null;
    if (conflict) {
      await prisma.listing.delete({ where: { id: conflict.id } });
    }
    await prisma.listing.update({
      where: { id },
      data: {
        name: room.name,
        ...(nextUrl ? { sourceUrl: nextUrl } : {}),
        ...(room.address ? { address: room.address } : {}),
        ...(room.latitude != null && room.longitude != null
          ? { latitude: room.latitude, longitude: room.longitude, locationQuality: "approximate" }
          : {}),
        ...(room.gender !== "unknown" ? { gender: room.gender } : {}),
        ...(room.availability !== "unknown" ? { availability: room.availability } : {}),
        ...(room.priceAmount != null ? { priceAmount: room.priceAmount, priceRaw: room.priceRaw } : {}),
        ...(room.roomSizeM2 != null ? { roomSizeM2: room.roomSizeM2 } : {}),
        ...(room.electricityStatus !== "unknown" ? { electricityStatus: room.electricityStatus } : {}),
        ...(room.facilities.length > 0 ? { facilities: JSON.stringify(room.facilities) } : {}),
        ...(room.description ? { description: room.description } : {}),
        ...(room.extraFeesNote ? { extraFeesNote: room.extraFeesNote } : {}),
        ...(room.imageUrls.length > 0 ? { imageUrls: JSON.stringify(room.imageUrls) } : {}),
        rawText: room.rawText,
        lastCheckedAt: new Date(),
      },
    });
    return getListing(id);
  }

  throw new Error("Situs ini belum bisa diperbarui otomatis.");
}

async function fetchMamikosStory(html: string): Promise<Record<string, unknown> | null> {
  const id = readMamikosDetailId(html);
  if (!id) return null;
  try {
    const response = await fetch(`https://mamikos.com/garuda/stories/${id}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { story?: unknown };
    return body.story && typeof body.story === "object" ? (body.story as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
