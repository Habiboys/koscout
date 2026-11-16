export function formatIdr(amount: number | null | undefined): string {
  if (amount == null) {
    return "Belum diketahui";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) {
    return "Belum diketahui";
  }
  return `${km.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

export function formatMinutes(seconds: number | null | undefined): string {
  if (seconds == null) {
    return "Belum tersedia";
  }
  return `${Math.max(1, Math.round(seconds / 60))} menit`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function commuteLabel(status: string, seconds: number | null | undefined): string {
  if (status === "ready") return formatMinutes(seconds);
  if (status === "limited") return "Belum dihitung (batas permintaan)";
  if (status === "no-location") return "Lokasi belum diketahui";
  if (status === "no-office") return "Kantor belum dipasang";
  return "Belum tersedia";
}

export function formatWhen(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
