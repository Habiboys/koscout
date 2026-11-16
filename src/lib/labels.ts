export const GENDERS = ["putra", "putri", "campur", "unknown"] as const;
export type Gender = (typeof GENDERS)[number];

export const LOCATION_QUALITIES = ["exact", "approximate", "unknown"] as const;
export type LocationQuality = (typeof LOCATION_QUALITIES)[number];

export const PRICE_PERIODS = ["day", "month", "year", "unknown"] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];

export const AVAILABILITY = ["available", "full", "unknown"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export function displayGender(
  stored: string | null | undefined,
  ...hints: Array<string | null | undefined>
): Gender {
  if (stored === "putra" || stored === "putri" || stored === "campur") return stored;
  const text = hints.filter(Boolean).join(" ");
  const labeled = text.match(/(?:coliving|kos|kost)[\s•·\-|]*(putri|putra|campur)\b/i)?.[1]
    ?? text.match(/\b(putri|putra|campur)\b/i)?.[1];
  const value = labeled?.toLowerCase();
  if (value === "putra" || value === "putri" || value === "campur") return value;
  return "unknown";
}

export function genderLabel(value: string | null | undefined): string {
  switch (value) {
    case "putra":
      return "Putra";
    case "putri":
      return "Putri";
    case "campur":
      return "Campur";
    default:
      return "Belum diketahui";
  }
}

export function locationQualityLabel(value: string | null | undefined): string {
  switch (value) {
    case "exact":
      return "Titik dipasang sendiri";
    case "approximate":
      return "Perkiraan dari alamat";
    default:
      return "Lokasi belum diketahui";
  }
}

export function pricePeriodLabel(value: string | null | undefined): string {
  switch (value) {
    case "day":
      return "Harga asli harian, ditampilkan sebagai estimasi bulanan (×30)";
    case "year":
      return "Harga asli tahunan, ditampilkan sebagai estimasi bulanan (÷12)";
    case "month":
      return "Harga bulanan";
    default:
      return "Periode harga belum jelas";
  }
}

export function availabilityLabel(value: string | null | undefined): string {
  switch (value) {
    case "available":
      return "Tersedia";
    case "full":
      return "Penuh";
    default:
      return "Ketersediaan belum diketahui";
  }
}
