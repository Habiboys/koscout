import { facilityLabel } from "@/lib/facilities";
import type { ListingWithCommute } from "@/server/listings";
import type { NearbyReport } from "@/server/nearby/overpass";
import type { ScoreBreakdown } from "@/server/scoring/score";
import { routeProviderName } from "@/server/geospatial/routing";
import type { Weights } from "@/server/scoring/weights";
import type { Office } from "@prisma/client";

export type ExportPreferences = {
  maxBudget: number | null;
  maxCommuteMinutes: number | null;
  requiredFacilities: string[];
};

export function buildExport(input: {
  office: Office | null;
  listings: Array<ListingWithCommute & { scores?: ScoreBreakdown | null; nearbyReport?: NearbyReport | null }>;
  preferences: ExportPreferences;
  weights?: Weights | null;
  generatedAt?: Date;
}) {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  return {
    schemaVersion: "1.0" as const,
    generatedAt,
    office: input.office
      ? {
          name: input.office.name,
          address: input.office.address,
          latitude: input.office.latitude,
          longitude: input.office.longitude,
        }
      : null,
    preferences: {
      maxBudget: input.preferences.maxBudget,
      maxCommuteMinutes: input.preferences.maxCommuteMinutes,
      transportMode: "motorcycle" as const,
      requiredFacilities: input.preferences.requiredFacilities.map(facilityLabel),
      weights: input.weights ?? null,
    },
    listings: input.listings.map((listing) => ({
      id: listing.id,
      name: listing.name,
      source: listing.sourceName,
      sourceUrl: listing.sourceUrl,
      address: listing.address,
      gender: listing.gender === "unknown" ? null : listing.gender,
      priceMonthly: listing.priceAmount,
      pricePeriod: listing.pricePeriod,
      isStartingPrice: listing.isStartingPrice,
      extraFeesNote: listing.extraFeesNote,
      facilities: listing.facilities.map(facilityLabel),
      distanceToOfficeKm: listing.distanceKm,
      commuteMinutes:
        listing.durationSeconds == null ? null : Math.max(1, Math.round(listing.durationSeconds / 60)),
      nearby: listing.nearbyReport ?? null,
      scores: listing.scores ?? null,
      availability: listing.availability === "unknown" ? null : listing.availability,
      dataQuality: {
        locationVerified: listing.locationQuality === "exact",
        priceVerified: false,
        locationQuality: listing.locationQuality,
        completeness: listing.completeness,
        lastCheckedAt: listing.lastCheckedAt,
        routeStatus: listing.routeStatus,
      },
    })),
    notes: [
      `Waktu tempuh memakai profil mengemudi ${routeProviderName()} dan tidak memuat data kemacetan.`,
      "Field null berarti data belum diketahui, bukan nol atau gratis.",
      "Harga harian diestimasi ×30 dan harga tahunan diestimasi ÷12.",
    ],
  };
}

export function buildPrompt(data: ReturnType<typeof buildExport>): string {
  return [
    "Analisis data kos berikut berdasarkan harga, fasilitas, waktu perjalanan ke kantor, dan kelengkapan data.",
    "",
    "Bandingkan seluruh kos secara objektif. Jelaskan kelebihan dan kekurangan masing-masing, identifikasi biaya yang belum diketahui, serta rekomendasikan hingga tiga kos terbaik.",
    "",
    "Prioritaskan waktu perjalanan dan total pengeluaran bulanan. Jangan mengarang informasi yang tidak tersedia. Nilai null berarti data belum diketahui, bukan nol. Jelaskan jika lokasi atau harga belum terverifikasi.",
    "",
    "Gunakan data JSON berikut sebagai sumber utama:",
    "",
    JSON.stringify(data, null, 2),
  ].join("\n");
}
