import { facilityLabel } from "@/lib/facilities";
import { formatIdr, formatKm, formatMinutes } from "@/lib/format";
import type { ListingWithCommute } from "@/server/listings";
import { routeProviderName } from "@/server/geospatial/routing";
import type { ScoreBreakdown } from "@/server/scoring/score";

export function buildMarkdown(input: {
  officeName: string | null;
  listings: Array<ListingWithCommute & { scores?: ScoreBreakdown | null; nearbySummary?: string | null }>;
}): string {
  const header = ["# Perbandingan Koscout", "", input.officeName ? `Kantor: ${input.officeName}` : "Kantor belum dipasang.", ""];
  const table = [
    "| Parameter | " + input.listings.map((listing) => listing.name).join(" | ") + " |",
    "| --- | " + input.listings.map(() => "---").join(" | ") + " |",
    row("Harga", input.listings.map((listing) => formatIdr(listing.priceAmount))),
    row("Jarak", input.listings.map((listing) => formatKm(listing.distanceKm))),
    row("Waktu", input.listings.map((listing) => formatMinutes(listing.durationSeconds))),
    row("Fasilitas", input.listings.map((listing) => listing.facilities.map(facilityLabel).join(", ") || "Belum diketahui")),
    row("Skor", input.listings.map((listing) => (listing.scores?.overall == null ? "Belum diketahui" : String(listing.scores.overall)))),
    row("Sekitar", input.listings.map((listing) => listing.nearbySummary ?? "Belum dihitung")),
  ];
  return [...header, ...table, "", `Waktu tempuh ${routeProviderName()} tanpa data kemacetan. Nilai kosong berarti data belum diketahui.`].join("\n");
}

function row(label: string, cells: string[]): string {
  return `| ${label} | ${cells.join(" | ")} |`;
}
