import type { PricePeriod } from "@/lib/labels";

export type PriceParse = {
  priceAmount: number | null;
  priceRaw: string | null;
  pricePeriod: PricePeriod | null;
  isStartingPrice: boolean;
  extraFeesNote: string | null;
  estimateNote: string | null;
};

const EMPTY: PriceParse = {
  priceAmount: null,
  priceRaw: null,
  pricePeriod: null,
  isStartingPrice: false,
  extraFeesNote: null,
  estimateNote: null,
};

const PRICE_PATTERN =
  /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?:\s*(jt|juta|rb|ribu))?(?:\s*(?:\/|per)\s*(hari|bulan|bln|tahun|thn))?/gi;

type Match = {
  raw: string;
  index: number;
  amount: number;
  period: PricePeriod | null;
  hasCurrency: boolean;
  hasSuffix: boolean;
  hasPeriod: boolean;
};

export function parsePrice(text: string): PriceParse {
  if (!text.trim()) {
    return EMPTY;
  }

  const matches = collectMatches(text).filter((match) => !isDepositContext(text, match.index));
  const ranked = matches
    .map((match) => ({ match, score: scoreMatch(match) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.match.index - b.match.index);

  const best = ranked[0]?.match;
  if (!best) {
    return { ...EMPTY, extraFeesNote: extractFeeNote(text) };
  }

  const monthly = toMonthly(best.amount, best.period);
  const isStartingPrice = /mulai\s+dari|start(?:ing)?\s+from|harga\s+mulai/i.test(
    text.slice(Math.max(0, best.index - 40), best.index + best.raw.length),
  );

  return {
    priceAmount: monthly.amount,
    priceRaw: best.raw.trim(),
    pricePeriod: monthly.period,
    isStartingPrice,
    extraFeesNote: extractFeeNote(text),
    estimateNote: monthly.note,
  };
}

function collectMatches(text: string): Match[] {
  const matches: Match[] = [];
  PRICE_PATTERN.lastIndex = 0;
  for (const found of text.matchAll(PRICE_PATTERN)) {
    const token = found[1];
    const suffix = found[2] ?? null;
    const periodWord = found[3] ?? null;
    if (!token || found.index === undefined) {
      continue;
    }
    const amount = parseIdrToken(token, suffix);
    if (amount == null || amount <= 0) {
      continue;
    }
    const prefix = text.slice(Math.max(0, found.index - 4), found.index);
    matches.push({
      raw: found[0],
      index: found.index,
      amount,
      period: mapPeriod(periodWord),
      hasCurrency: /rp\.?\s*$/i.test(prefix) || /rp/i.test(found[0]),
      hasSuffix: Boolean(suffix),
      hasPeriod: Boolean(periodWord),
    });
  }
  return matches;
}

function scoreMatch(match: Match): number {
  let score = 0;
  if (match.hasCurrency) score += 3;
  if (match.hasPeriod) score += 3;
  if (match.hasSuffix) score += 2;
  if (match.amount >= 100_000 && match.amount <= 50_000_000) score += 2;
  if (match.amount < 10_000 && !match.hasSuffix && !match.hasPeriod) score -= 4;
  if (!match.hasCurrency && !match.hasSuffix && !match.hasPeriod) score -= 3;
  return score;
}

function isDepositContext(text: string, index: number): boolean {
  const around = text.slice(Math.max(0, index - 24), index + 24).toLowerCase();
  return /deposit/.test(around);
}

export function parseIdrToken(raw: string, suffix: string | null): number | null {
  const compact = raw.replace(/\s/g, "");
  const unit = suffix?.toLowerCase() ?? null;
  let value: number;

  if (unit === "jt" || unit === "juta" || unit === "rb" || unit === "ribu") {
    const normalized = compact.replace(",", ".");
    value = Number(normalized);
    if (!Number.isFinite(value)) {
      return null;
    }
    value *= unit === "jt" || unit === "juta" ? 1_000_000 : 1_000;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    value = Number(compact.replace(/\./g, ""));
  } else if (/^\d{1,3}(,\d{3})+$/.test(compact)) {
    value = Number(compact.replace(/,/g, ""));
  } else {
    value = Number(compact.replace(/[^\d]/g, ""));
  }

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

function mapPeriod(word: string | null): PricePeriod | null {
  if (!word) return null;
  const value = word.toLowerCase();
  if (value === "hari") return "day";
  if (value === "bulan" || value === "bln") return "month";
  if (value === "tahun" || value === "thn") return "year";
  return null;
}

function toMonthly(
  amount: number,
  period: PricePeriod | null,
): { amount: number | null; period: PricePeriod | null; note: string | null } {
  if (period === "day") {
    return {
      amount: amount * 30,
      period: "day",
      note: "Harga harian diestimasi ke bulanan dengan ×30 hari.",
    };
  }
  if (period === "year") {
    return {
      amount: Math.round(amount / 12),
      period: "year",
      note: "Harga tahunan diestimasi ke bulanan dengan ÷12.",
    };
  }
  if (period === "month") {
    return { amount, period: "month", note: null };
  }
  if (amount >= 300_000 && amount <= 50_000_000) {
    return { amount, period: "month", note: null };
  }
  return {
    amount: null,
    period: "unknown",
    note: "Angka harga ditemukan, tetapi periodenya belum jelas sehingga tidak diubah menjadi harga bulanan.",
  };
}

export function extractFeeNote(text: string): string | null {
  const lines = text
    .split(/\n|•|\|/)
    .map((line) => line.trim())
    .filter((line) => /listrik|\bair\b|deposit|biaya|laundry/i.test(line));

  if (lines.length > 0) {
    return lines.slice(0, 3).join(" · ");
  }

  const keys = ["listrik", "air", "deposit", "laundry"].filter((key) =>
    new RegExp(key, "i").test(text),
  );
  if (keys.length === 0) {
    return null;
  }
  return `Teks menyebut: ${keys.join(", ")}. Nilainya belum dipisahkan dari harga sewa.`;
}
