import Link from "next/link";
import { AiPanel } from "@/components/compare/ai-panel";
import { CompareBoard, type CompareColumn } from "@/components/compare/compare-board";
import { ExportBar } from "@/components/compare/export-bar";
import { facilityLabel } from "@/lib/facilities";
import { parseDetailMeta } from "@/lib/detail-meta";
import { commuteLabel, formatIdr, formatKm, formatPercent } from "@/lib/format";
import { genderLabel } from "@/lib/labels";
import { monthlyCost, transportMonthlyCost } from "@/server/cost/monthly-cost";
import { distanceKm } from "@/server/geospatial/distance";
import { enrichListings } from "@/server/enrich";
import { attachCommute, getActiveOffice, getListingsByIds, type ListingWithCommute } from "@/server/listings";
import { routeProviderName } from "@/server/geospatial/routing";
import { readIdList, readSearchFilters } from "@/server/search-params";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  const ids = readIdList(params);
  const filters = readSearchFilters(params);
  const office = await getActiveOffice();
  const listings = await attachCommute(await getListingsByIds(ids), office);
  const enriched = await enrichListings(listings);
  const costs = new Map(listings.map((listing) => [listing.id, costOf(listing)]));
  const order = surveyOrder(office, listings);
  const prices = listings.map((listing) => listing.priceAmount).filter((price): price is number => price != null);
  const times = listings
    .map((listing) => listing.durationSeconds)
    .filter((seconds): seconds is number => seconds != null);
  const cheapest = prices.length > 0 ? Math.min(...prices) : null;
  const fastest = times.length > 0 ? Math.min(...times) : null;
  const mostFacilities = Math.max(...listings.map((listing) => listing.facilities.length));
  const overalls = listings
    .map((listing) => enriched.scores[listing.id]?.overall)
    .filter((score): score is number => score != null);
  const bestOverall = overalls.length > 0 ? Math.max(...overalls) : null;
  const monthlyValues = listings
    .map((listing) => costs.get(listing.id)?.monthly)
    .filter((value): value is number => value != null);
  const lowestMonthly = monthlyValues.length > 0 ? Math.min(...monthlyValues) : null;
  const transportScores = listings
    .map((listing) => enriched.scores[listing.id]?.transport)
    .filter((score): score is number => score != null);
  const bestTransport = transportScores.length > 0 ? Math.max(...transportScores) : null;
  const nearest = listings.reduce<ListingWithCommute | null>((best, listing) => {
    if (listing.distanceKm == null) return best;
    if (!best || best.distanceKm == null || listing.distanceKm < best.distanceKm) return listing;
    return best;
  }, null);
  const cheapestListing = listings.find((listing) => listing.priceAmount != null && listing.priceAmount === cheapest) ?? null;
  const fastestListing = listings.find((listing) => listing.durationSeconds != null && listing.durationSeconds === fastest) ?? null;
  const exportHref = `/api/export?${params.toString()}`;
  const columns = listings.map((listing) =>
    toColumn(listing, {
      cheapest,
      fastest,
      nearestId: nearest?.id ?? null,
      mostFacilities,
      bestOverall,
      lowestMonthly,
      bestTransport,
      monthly: costs.get(listing.id)?.monthly ?? null,
      missing: costs.get(listing.id)?.missing ?? [],
      score: enriched.scores[listing.id]?.overall ?? null,
      transport: enriched.scores[listing.id]?.transport ?? null,
    }),
  );

  return (
    <div className="stack">
      <section className="card card-pad stack">
        <h1>Perbandingan</h1>
        <p className="muted">
          {office ? `Diukur dari ${office.name}.` : "Kantor belum dipasang."} Waktu tempuh dari {routeProviderName()}, tanpa data kemacetan.
          Kotak hijau adalah yang paling unggul di baris itu. Angka yang belum diketahui tidak dihitung sebagai nol.
        </p>
        {listings.length >= 2 ? (
          <div className="compare-picks">
            {cheapestListing ? (
              <Link href={`/listings/${cheapestListing.id}`}>
                <strong>Termurah</strong> · {shortName(cheapestListing.name)} · {formatIdr(cheapestListing.priceAmount)}
              </Link>
            ) : null}
            {nearest ? (
              <Link href={`/listings/${nearest.id}`}>
                <strong>Terdekat</strong> · {shortName(nearest.name)} · {formatKm(nearest.distanceKm)}
              </Link>
            ) : null}
            {fastestListing ? (
              <Link href={`/listings/${fastestListing.id}`}>
                <strong>Tercepat</strong> · {shortName(fastestListing.name)} · {commuteLabel(fastestListing.routeStatus, fastestListing.durationSeconds)}
              </Link>
            ) : null}
          </div>
        ) : null}
        {order.length > 1 ? (
          <p className="muted">
            Kalau disurvei dari kantor, urutannya: {order.map((listing, index) => `${index + 1}. ${shortName(listing.name)}`).join(" · ")}
          </p>
        ) : null}
        {filters.maxBudget || filters.maxMinutes || filters.facilities.length > 0 ? (
          <p className="muted">
            Filter yang masih aktif: budget {filters.maxBudget ? formatIdr(filters.maxBudget) : "bebas"} · menit{" "}
            {filters.maxMinutes ?? "bebas"} · fasilitas{" "}
            {filters.facilities.length > 0 ? filters.facilities.map(facilityLabel).join(", ") : "tidak ada"}
          </p>
        ) : null}
        {listings.length >= 2 ? <ExportBar href={exportHref} /> : null}
        {listings.length < 2 ? (
          <p>
            Pilih 2–10 kos dari halaman cari. <Link href="/search">Kembali ke pencarian</Link>
          </p>
        ) : null}
      </section>
      {listings.length >= 2 ? <CompareBoard columns={columns} /> : null}
      {listings.length >= 1 ? <AiPanel ids={listings.map((listing) => listing.id)} /> : null}
    </div>
  );
}

function toColumn(
  listing: ListingWithCommute,
  marks: {
    cheapest: number | null;
    fastest: number | null;
    nearestId: string | null;
    mostFacilities: number;
    bestOverall: number | null;
    lowestMonthly: number | null;
    bestTransport: number | null;
    monthly: number | null;
    missing: string[];
    score: number | null;
    transport: number | null;
  },
): CompareColumn {
  const meta = parseDetailMeta(listing.rawText);
  const badges = [
    listing.priceAmount != null && listing.priceAmount === marks.cheapest ? "Termurah" : null,
    listing.id === marks.nearestId ? "Terdekat" : null,
    listing.durationSeconds != null && listing.durationSeconds === marks.fastest ? "Tercepat" : null,
    marks.lowestMonthly != null && marks.monthly === marks.lowestMonthly ? "Biaya total terendah" : null,
    listing.facilities.length > 0 && listing.facilities.length === marks.mostFacilities ? "Fasilitas terbanyak" : null,
    marks.bestOverall != null && marks.score === marks.bestOverall ? "Skor tertinggi" : null,
    marks.bestTransport != null && marks.transport === marks.bestTransport ? "Transport terbaik" : null,
  ].filter((item): item is string => Boolean(item));
  const note = meta?.facilityNote ?? listing.extraFeesNote;

  return {
    id: listing.id,
    name: listing.name,
    imageUrl: listing.imageUrls[0] ?? null,
    sourceName: listing.sourceName,
    sourceUrl: listing.sourceUrl,
    badges,
    price: `${formatIdr(listing.priceAmount)}${listing.isStartingPrice ? " (mulai dari)" : ""}`,
    priceHint: priceHint(listing.pricePeriod),
    priceBest: listing.priceAmount != null && listing.priceAmount === marks.cheapest,
    distance: formatKm(listing.distanceKm),
    distanceHint: listing.routeStatus === "ready" ? "lewat jalan" : "garis lurus",
    distanceBest: listing.id === marks.nearestId,
    duration: commuteLabel(listing.routeStatus, listing.durationSeconds),
    durationBest: listing.durationSeconds != null && listing.durationSeconds === marks.fastest,
    gender: listing.gender === "unknown" ? "Belum diketahui" : `Kos ${genderLabel(listing.gender)}`,
    size: listing.roomSizeM2 != null ? `${listing.roomSizeM2.toLocaleString("id-ID")} m²` : "Belum diketahui",
    electricity:
      listing.electricityStatus === "included"
        ? "Termasuk"
        : listing.electricityStatus === "excluded"
          ? "Bayar sendiri"
          : "Belum diketahui",
    rating:
      meta?.rating != null
        ? `${meta.rating.toLocaleString("id-ID")}${meta.reviewCount != null ? ` · ${meta.reviewCount} review` : ""}`
        : null,
    rooms: meta?.availableRoomsCount != null ? `${meta.availableRoomsCount} kamar` : null,
    monthly: formatIdr(marks.monthly),
    monthlyHint: marks.missing.length > 0 ? `Belum termasuk ${marks.missing.join(", ")}` : null,
    monthlyBest: marks.lowestMonthly != null && marks.monthly === marks.lowestMonthly,
    perM2:
      listing.priceAmount != null && listing.roomSizeM2
        ? formatIdr(Math.round(listing.priceAmount / listing.roomSizeM2))
        : "Belum diketahui",
    facilities: listing.facilities.map(facilityLabel),
    note: note ? clip(note, 160) : null,
    score: marks.score != null ? String(marks.score) : "Belum diketahui",
    scoreBest: marks.bestOverall != null && marks.score === marks.bestOverall,
    completeness: formatPercent(listing.completeness),
  };
}

function priceHint(period: string | null): string | null {
  if (period === "day") return "Diubah dari harga harian";
  if (period === "year") return "Diubah dari harga tahunan";
  if (period === "month") return "Harga per bulan";
  return null;
}

function shortName(name: string): string {
  return name.replace(/\s+(Bandung|Kota Bandung)$/i, "").trim();
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function costOf(listing: ListingWithCommute) {
  return monthlyCost({
    rent: listing.priceAmount,
    electricityStatus: listing.electricityStatus,
    electricityMonthly: listing.electricityMonthly,
    internetStatus: listing.internetStatus,
    internetMonthly: listing.internetMonthly,
    laundryMonthly: listing.laundryMonthly,
    otherMonthly: listing.otherMonthly,
    transportMonthly: transportMonthlyCost(listing.distanceKm, "motorcycle"),
    depositAmount: listing.depositAmount,
    adminFee: listing.adminFee,
    movingFee: listing.movingFee,
  });
}

function surveyOrder(
  office: { latitude: number; longitude: number } | null,
  listings: ListingWithCommute[],
): ListingWithCommute[] {
  if (!office) return [];
  const remaining = listings.filter((listing) => listing.latitude != null && listing.longitude != null);
  const order: ListingWithCommute[] = [];
  let cursor = office;
  while (remaining.length > 0) {
    remaining.sort((left, right) => {
      const leftKm = distanceKm(cursor, { latitude: left.latitude as number, longitude: left.longitude as number });
      const rightKm = distanceKm(cursor, { latitude: right.latitude as number, longitude: right.longitude as number });
      return leftKm - rightKm;
    });
    const next = remaining.shift();
    if (!next || next.latitude == null || next.longitude == null) break;
    order.push(next);
    cursor = { latitude: next.latitude, longitude: next.longitude };
  }
  return order;
}
