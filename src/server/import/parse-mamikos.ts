import { deduplicateImages, serializeDetailMeta, type ListingDetailMeta } from "@/lib/detail-meta";
import { parseFacilities } from "@/lib/facilities";
import type { Availability, Gender } from "@/lib/labels";

export type CapturedCard = {
  html: string;
  href: string | null;
  text: string;
  images: string[];
};

export type MamikosCard = {
  name: string;
  sourceUrl: string | null;
  area: string | null;
  gender: Gender;
  priceAmount: number | null;
  priceRaw: string | null;
  isStartingPrice: boolean;
  note: string | null;
  facilities: string[];
  imageUrls: string[];
  rawText: string;
};

export function parseMamikosCards(cards: CapturedCard[]): MamikosCard[] {
  const parsed: MamikosCard[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    const item = parseMamikosCard(card);
    if (!item) continue;
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(item);
  }
  return parsed;
}

export function parseMamikosCard(card: CapturedCard): MamikosCard | null {
  const name = field(card.html, "rc-info__name") ?? titledLine(card.text);
  if (!name) return null;
  const area = field(card.html, "rc-info__location");
  const labeled = card.text.match(/\b(Putri|Putra|Campur)\b/i)?.[1];
  const real = fieldByTestId(card.html, "kostListPriceReal") ?? card.text.match(/Rp\s*[\d.]+/i)?.[0] ?? null;
  const firstMonth = /bulan pertama/i.test(card.text);
  return {
    name,
    sourceUrl: mamikosUrl(card.href),
    area,
    gender: genderOf(labeled),
    priceAmount: rupiah(real),
    priceRaw: real,
    isStartingPrice: firstMonth || /mulai/i.test(card.text),
    note: firstMonth ? "Harga di kartu adalah bulan pertama." : null,
    facilities: parseFacilities(card.text),
    imageUrls: deduplicateImages(card.images).slice(0, 4),
    rawText: card.text.slice(0, 2000),
  };
}

function field(html: string, className: string): string | null {
  const match = html.match(new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([^<]+)`));
  const text = match?.[1]?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function fieldByTestId(html: string, testId: string): string | null {
  const match = html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]+)`));
  const text = match?.[1]?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function titledLine(text: string): string | null {
  const line = text
    .split(/\s{2,}|\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 4 && !/^rp\b/i.test(item) && !/^(putri|putra|campur)$/i.test(item));
  return line ?? null;
}

function genderOf(value: string | undefined): Gender {
  const label = value?.toLowerCase();
  if (label === "putri" || label === "putra" || label === "campur") return label;
  return "unknown";
}

function rupiah(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]{4,})/);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(".", ""));
  if (!Number.isInteger(amount) || amount < 100_000 || amount > 100_000_000) return null;
  return amount;
}

function mamikosUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "mamikos.com") return null;
    return url.toString().slice(0, 2000);
  } catch {
    return null;
  }
}

export type MamikosRoom = {
  name: string;
  sourceUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  gender: Gender;
  availability: Availability;
  priceAmount: number | null;
  priceRaw: string | null;
  roomSizeM2: number | null;
  electricityStatus: "included" | "excluded" | "unknown";
  facilities: string[];
  description: string | null;
  extraFeesNote: string | null;
  imageUrls: string[];
  detailMeta: ListingDetailMeta;
  rawText: string;
};

export function readMamikosDetailId(html: string): string | null {
  const id = readDetailJson(html)?._id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  if (typeof id === "string" && /^\d+$/.test(id)) return id;
  return null;
}

export function readMamikosRoom(
  html: string,
  fallbackUrl: string | null = null,
  story: Record<string, unknown> | null = null,
): MamikosRoom | null {
  const detail = mergeDetail(readDetailJson(html), story);
  const name =
    readText(detail?.room_title) ??
    field(html, "detail-title__room-name") ??
    meta(html, "og:title");
  if (!name) return null;

  const slug = readText(detail?.slug);
  const sourceUrl =
    mamikosUrl(slug ? `https://mamikos.com/room/${slug}` : meta(html, "og:url") ?? fallbackUrl) ?? null;
  const mapCoords = html.match(/maps\.google\.com\/maps\?[^"]*q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const latitude = numberOf(detail?.latitude) ?? (mapCoords ? Number(mapCoords[1]) : null);
  const longitude = numberOf(detail?.longitude) ?? (mapCoords ? Number(mapCoords[2]) : null);
  const area = readText(detail?.area_subdistrict) ?? field(html, "detail-kost-overview__area-text");
  const city = readText(detail?.area_city) ?? "Bandung";

  const monthlyFormat =
    detail?.price_title_formats && typeof detail.price_title_formats === "object"
      ? ((detail.price_title_formats as Record<string, unknown>).price_monthly as Record<string, unknown> | null)
      : null;
  const discountPrice = readText(monthlyFormat?.discount_price);
  const normalPrice = readText(monthlyFormat?.price);
  const discountPercent = readText(monthlyFormat?.discount);

  const priceText =
    (discountPrice ? `Rp${discountPrice}` : null) ??
    fieldByTestId(html, "kostDetailPriceReal") ??
    readText(detail?.price_title_time) ??
    (normalPrice ? `Rp${normalPrice}` : null) ??
    html.match(/price_monthly"\s*:\s*\{[^}]*"price"\s*:\s*"([\d.]+)"/)?.[1] ??
    null;

  const roomFacilities = uniqueStrings([
    ...iconNames(detail?.fac_room_icon),
    ...domFacilityLabels(html, "detail-kost-room-facilities"),
  ]);
  const bathFacilities = uniqueStrings([
    ...iconNames(detail?.fac_bath_icon),
    ...domFacilityLabels(html, "detail-kost-bathroom-facilities"),
  ]);
  const sharedFacilities = uniqueStrings([
    ...iconNames(detail?.fac_share_icon),
    ...domFacilityLabels(html, "detail-kost-public-facilities"),
  ]);
  const parkingFacilities = uniqueStrings([
    ...iconNames(detail?.fac_park_icon),
    ...domFacilityLabels(html, "detail-kost-parking-facilities"),
  ]);
  const priceFacilities = uniqueStrings([
    ...iconNames(detail?.fac_price_icon),
    ...domFacilityLabels(html, "detail-kost-room-specification"),
  ]);
  const ruleItems = uniqueStrings([
    ...domRuleLabels(html, 'class="detail-kost-special-rules"'),
    ...domRuleLabels(html, 'class="detail-kost-rules"'),
    ...iconNames(detail?.kos_rule_icon),
    ...bookingRuleLabels(detail),
    ...domBookingTerms(html),
  ]);
  const nearbyPois = uniqueStrings([...domLandmarks(html), ...iconNames(detail?.fac_near_icon)]);

  const facNames = [
    ...roomFacilities,
    ...bathFacilities,
    ...sharedFacilities,
    ...parkingFacilities,
    ...priceFacilities,
    ...[...html.matchAll(/class="detail-kost-facility-item__label[^"]*"[^>]*>([^<]+)</g)].map((item) => item[1] ?? ""),
    fieldByTestId(html, "kost-facility-note-description") ?? "",
    readText(detail?.remarks) ?? "",
  ].join(" ");

  const sizeRaw =
    readText(detail?.size)?.replace(/\s*x\s*/i, " x ") ??
    priceFacilities.find((item) => /\d+\s*x\s*\d+/i.test(item)) ??
    facNames.match(/(\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?(?:\s*meter)?)/i)?.[1] ??
    null;
  const sizeMatch = (sizeRaw ?? facNames).match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
  const roomSizeM2 = sizeMatch ? Number(sizeMatch[1]?.replace(",", ".")) * Number(sizeMatch[2]?.replace(",", ".")) : null;

  const availableMatch = html.match(/Tersisa[\s\S]{0,160}?(\d+)\s*kamar/i);
  const available = numberOf(detail?.available_room) ?? (availableMatch ? Number(availableMatch[1]) : null);
  const availability: Availability =
    available != null ? (available > 0 ? "available" : "full") : /tersisa\s+\d+\s+kamar/i.test(html) ? "available" : "unknown";

  const genderBox = field(html, "detail-kost-overview__gender-box");
  const genderNum = numberOf(detail?.gender);
  const gender: Gender =
    genderNum === 2 ? "putri" : genderNum === 1 ? "putra" : genderNum === 0 ? "campur" : genderOf(genderBox?.replace(/^kos\s+/i, ""));

  const electric = /tidak termasuk listrik/i.test(facNames)
    ? ("excluded" as const)
    : /termasuk listrik/i.test(facNames)
      ? ("included" as const)
      : ("unknown" as const);

  const domStory = blockText(html, "kost-owner-story-content");
  const htmlStory = htmlToPlain(readText(detail?.html_description));
  const jsonStory = readText(detail?.description);
  const storyText =
    domStory ??
    (htmlStory?.includes("\n") ? htmlStory : null) ??
    jsonStory ??
    htmlStory ??
    fieldByTestId(html, "kost-owner-story-content") ??
    meta(html, "og:description");
  const note = readText(detail?.remarks) ?? blockText(html, "kost-facility-note-description") ?? fieldByTestId(html, "kost-facility-note-description");

  const levelName =
    detail?.level_info && typeof detail.level_info === "object"
      ? readText((detail.level_info as Record<string, unknown>).name)
      : null;
  const brandBadge =
    levelName ??
    (/kos-andalan/i.test(html) ? "Kos Andalan" : detail?.is_singgahsini ? "Singgahsini" : detail?.is_apik ? "Kos Apik" : null);

  const domOwner = field(html, "detail-kost-owner-section__owner-title");
  const ownerHeader = readText(detail?.owner_header);
  const ownerNameRaw = readText(detail?.owner_name);
  const headerIsGeneric = !ownerHeader || /^pemilik kos$/i.test(ownerHeader);
  const namedOwner = ownerNameRaw ? `Kos disewakan oleh ${ownerNameRaw}` : null;
  const ownerName =
    (domOwner && (headerIsGeneric || /disewakan oleh/i.test(domOwner)) ? domOwner : null) ??
    (headerIsGeneric ? namedOwner : ownerHeader) ??
    namedOwner;
  const onlineText = field(html, "detail-kost-owner-section__last-online-text");
  const onlineJson = readText(detail?.online);
  const updatedText = readText(detail?.updated_at);
  const ownerStatus = onlineText ? `Online ${onlineText}` : onlineJson ?? (updatedText ? `Diperbarui ${updatedText}` : null);
  const ownerPhotoUrl =
    readText(detail?.owner_photo_url) ??
    html.match(/class="detail-kost-owner-section__owner-photo"[^>]+src="([^"]+)"/i)?.[1] ??
    null;

  const pageReviews = domReviews(html);
  const specItems = uniqueStrings([
    sizeRaw ? (/meter/i.test(sizeRaw) ? sizeRaw : `${sizeRaw} meter`) : null,
    electric === "included" ? "Termasuk listrik" : electric === "excluded" ? "Tidak termasuk listrik" : null,
    ...priceFacilities,
  ]);

  const detailMeta: ListingDetailMeta = {
    brandBadge,
    ownerName,
    ownerStatus,
    ownerPhotoUrl,
    availableRoomsCount: available,
    sizeRaw: sizeRaw ? (/meter/i.test(sizeRaw) ? sizeRaw : `${sizeRaw} meter`) : null,
    specItems,
    roomFacilities,
    bathFacilities,
    sharedFacilities,
    parkingFacilities,
    rules: ruleItems,
    facilityNote: note,
    ownerStory: storyText?.slice(0, 2000) ?? null,
    nearbyPois,
    originalPriceRaw: discountPrice && normalPrice && discountPrice !== normalPrice ? `Rp${normalPrice}` : null,
    discountLabel: discountPercent ? `Hemat ${discountPercent}` : null,
    rating: numberField(html, "detail-kost-overview__rating-text") ?? numberOf(detail?.rating),
    reviewCount:
      countField(html, "detail-kost-overview__rating-review") ??
      numberOf(detail?.review_count) ??
      numberOf(detail?.review_count_total),
    ratingParts: ratingParts(detail?.all_rating),
    transactionLabel:
      field(html, "detail-kost-overview__total-transaction-text") ??
      (numberOf(detail?.transaction_count) != null
        ? `${numberOf(detail?.transaction_count)} transaksi berhasil di kos ini`
        : null),
    refundNote:
      field(html, "detail-kost-refund__description") ??
      "Kos bisa refund sesuai ketentuan dan kebijakan refund Mamikos.",
    reviews: pageReviews.length > 0 ? pageReviews : jsonReviews(detail?.reviews),
    overviewCaptured: true,
  };

  return {
    name,
    sourceUrl,
    address: [area, city].filter(Boolean).join(", ") || null,
    latitude,
    longitude,
    gender,
    availability,
    priceAmount: rupiah(priceText),
    priceRaw: priceText,
    roomSizeM2: roomSizeM2 && Number.isFinite(roomSizeM2) ? Math.round(roomSizeM2 * 10) / 10 : null,
    electricityStatus: electric,
    facilities: parseFacilities(facNames),
    description: storyText?.slice(0, 1500) ?? null,
    extraFeesNote: note?.slice(0, 500) ?? null,
    imageUrls: roomImages(detail?.cards, html),
    detailMeta,
    rawText: serializeDetailMeta(detailMeta, [name, area, city, priceText, storyText].filter(Boolean).join("\n")),
  };
}

function mergeDetail(
  page: Record<string, unknown> | null,
  story: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!page && !story) return null;
  const detail: Record<string, unknown> = { ...(page ?? {}) };
  if (!story) return detail;
  for (const key of [
    "reviews",
    "rating",
    "review_count",
    "transaction_count",
    "all_rating",
    "html_description",
    "owner_name",
    "online",
    "booking_rules",
    "booking_terms",
    "description",
    "remarks",
  ]) {
    const value = story[key];
    if (value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    detail[key] = value;
  }
  return detail;
}

function bookingRuleLabels(detail: Record<string, unknown> | null): string[] {
  if (!detail) return [];
  const rules = detail.booking_rules && typeof detail.booking_rules === "object" ? (detail.booking_rules as Record<string, unknown>) : null;
  const terms = detail.booking_terms && typeof detail.booking_terms === "object" ? (detail.booking_terms as Record<string, unknown>) : null;
  const items: string[] = [];
  if (rules?.is_married === false || terms?.is_married === false) items.push("Tidak untuk pasutri");
  if (rules?.is_bring_child === false || terms?.is_bring_child === false) items.push("Tidak boleh bawa anak");
  if (Array.isArray(terms?.rent_count)) {
    for (const row of terms.rent_count) {
      if (!row || typeof row !== "object") continue;
      const rent = row as Record<string, unknown>;
      if (rent.duration_unit === "monthly" && numberOf(rent.duration) != null) {
        items.push(`Minimal durasi ngekos ${numberOf(rent.duration)} bulan.`);
      }
    }
  }
  if (terms?.required_identity_booking === true) items.push("Calon penyewa wajib sertakan KTP.");
  if (numberOf(terms?.min_checkin_date) === 0) items.push("Bisa mulai ngekos di hari H setelah pengajuan sewa.");
  const maxCheckin = numberOf(terms?.max_checkin_date);
  if (maxCheckin != null && terms?.max_checkin_date_unit === "month") {
    items.push(`Waktu mulai ngekos terjauh ${maxCheckin} bulan setelah pengajuan sewa.`);
  }
  return items;
}

function ratingParts(value: unknown): Array<{ label: string; score: number }> {
  if (!value || typeof value !== "object") return [];
  const scores = value as Record<string, unknown>;
  const labels: Array<[string, string]> = [
    ["clean", "Kebersihan"],
    ["happy", "Kenyamanan"],
    ["safe", "Keamanan"],
    ["pricing", "Harga"],
    ["room_facilities", "Fasilitas kamar"],
    ["public_facilities", "Fasilitas umum"],
  ];
  return labels.flatMap(([key, label]) => {
    const score = numberOf(scores[key]);
    return score == null ? [] : [{ label, score: Math.round(score * 10) / 10 }];
  });
}

function jsonReviews(value: unknown) {
  if (!Array.isArray(value)) return [];
  const reviews = [];
  for (const item of value.slice(0, 4)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const author = readText(row.name);
    if (!author) continue;
    const rating = numberOf(row.rating);
    reviews.push({
      author,
      ago: readText(row.tanggal),
      rating,
      text: readText(row.content) ?? "",
    });
  }
  return reviews;
}

function htmlToPlain(value: string | null): string | null {
  if (!value) return null;
  const text = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function readDetailJson(html: string): Record<string, unknown> | null {
  const start = html.indexOf("var detail =");
  if (start < 0) return null;
  const end = html.indexOf("; detail.type", start);
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(start + 12, end).trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function iconNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? readText((item as Record<string, unknown>).name) : null))
    .filter((item): item is string => Boolean(item));
}

function domFacilityLabels(html: string, sectionClass: string): string[] {
  const index = html.indexOf(sectionClass);
  if (index < 0) return [];
  const chunk = html.slice(index, index + 18000);
  return [...chunk.matchAll(/class="detail-kost-facility-item__label[^"]*"[^>]*>([^<]+)</g)]
    .map((item) => item[1]?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean);
}

function domRuleLabels(html: string, marker: string): string[] {
  const index = html.indexOf(marker);
  if (index < 0) return [];
  const chunk = html.slice(index, index + 14000);
  const items: string[] = [];
  for (const match of chunk.matchAll(
    /class="detail-kost-rule-item__label[^"]*"[^>]*>([^<]+)<\/p>(?:\s*<p[^>]*class="detail-kost-rule-item__description[^"]*"[^>]*>([^<]*))?/g,
  )) {
    const title = match[1]?.replace(/\s+/g, " ").trim();
    const desc = match[2]?.replace(/\s+/g, " ").trim();
    if (title) items.push(desc ? `${title}. ${desc}` : title);
  }
  return items;
}

function domLandmarks(html: string): string[] {
  const items: string[] = [];
  const pattern =
    /class="landmark-item__text-ellipsis[^"]*"[^>]*>([^<]+)<\/p>\s*<p[^>]*class="landmark-item__landmark-distance[^"]*"[^>]*>([^<]+)/g;
  for (const match of html.matchAll(pattern)) {
    const name = match[1]?.replace(/\s+/g, " ").trim();
    const distance = match[2]?.replace(/\s+/g, " ").trim();
    if (name && distance) items.push(`${name} · ${distance}`);
  }
  return items;
}

function domReviews(html: string) {
  const start = html.indexOf("users-feedback-container--card");
  if (start < 0) return [];
  const chunk = html.slice(start, start + 24000);
  const reviews = [];
  for (const section of chunk.split("users-feedback__section").slice(1, 5)) {
    const author = section.match(/user-feedback__profile-name[^>]*>([^<]+)/)?.[1]?.replace(/\s+/g, " ").trim();
    if (!author) continue;
    const ago = section.match(/bg-c-text--label-2">([^<]+)/)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    const ratingText = section.match(/user-feedback__rating[\s\S]{0,500}?bg-c-text--body-1">([^<]+)/)?.[1]?.trim();
    const rating = ratingText ? Number(ratingText.replace(",", ".")) : null;
    const text = section.match(/user-feedback__content-text[^>]*>([^<]*)/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    reviews.push({ author, ago, rating: rating != null && Number.isFinite(rating) ? rating : null, text });
  }
  return reviews;
}

function numberField(html: string, className: string): number | null {
  const text = field(html, className);
  if (!text) return null;
  const parsed = Number(text.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function countField(html: string, className: string): number | null {
  const text = field(html, className);
  const digits = text?.match(/\d+/)?.[0];
  return digits ? Number(digits) : null;
}

function blockText(html: string, testId: string): string | null {
  const start = html.indexOf(`data-testid="${testId}"`);
  if (start < 0) return null;
  const openEnd = html.indexOf(">", start);
  if (openEnd < 0) return null;
  const close = html.indexOf("</div>", openEnd);
  if (close < 0) return null;
  const raw = html.slice(openEnd + 1, Math.min(close, openEnd + 4000));
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function domBookingTerms(html: string): string[] {
  const index = html.indexOf("booking-terms-content");
  if (index < 0) return [];
  const chunk = html.slice(index, index + 8000);
  const items: string[] = [];
  for (const match of chunk.matchAll(
    /class="booking-terms-list-item__title[^"]*"[^>]*>([^<]+)<\/p>\s*<p[^>]*class="booking-terms-list-item__description[^"]*"[^>]*>([^<]*)</g,
  )) {
    const title = match[1]?.replace(/\s+/g, " ").trim();
    const desc = match[2]?.replace(/\s+/g, " ").trim();
    if (title) items.push(desc ? `${title} ${desc}` : title);
  }
  return items;
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

function roomImages(cards: unknown, html: string): string[] {
  const found: string[] = [];
  if (Array.isArray(cards)) {
    for (const item of cards) {
      if (!item || typeof item !== "object") continue;
      const photo = (item as Record<string, unknown>).photo_url;
      const large = photo && typeof photo === "object" ? readText((photo as Record<string, unknown>).large) : null;
      if (large && /^https:\/\//i.test(large)) found.push(large);
    }
  }
  const og = meta(html, "og:image");
  if (og && /^https:\/\//i.test(og)) found.push(og);
  return deduplicateImages(found).slice(0, 8);
}

function meta(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]+)"`, "i"));
  return match?.[1]?.trim() ?? null;
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberOf(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
