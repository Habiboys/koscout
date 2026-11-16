export type Weights = {
  price: number;
  commute: number;
  facilities: number;
  nearby: number;
  transport: number;
};

export const DEFAULT_WEIGHTS: Weights = {
  price: 25,
  commute: 30,
  facilities: 20,
  nearby: 15,
  transport: 10,
};

export function normalizeWeights(input: Partial<Weights> | null | undefined): Weights {
  const merged = { ...DEFAULT_WEIGHTS, ...strip(input) };
  const sum = merged.price + merged.commute + merged.facilities + merged.nearby + merged.transport;
  if (sum <= 0) return DEFAULT_WEIGHTS;
  const scale = 100 / sum;
  return {
    price: round(merged.price * scale),
    commute: round(merged.commute * scale),
    facilities: round(merged.facilities * scale),
    nearby: round(merged.nearby * scale),
    transport: round(merged.transport * scale),
  };
}

export function relativeScore(value: number, peers: number[], lowerIsBetter: boolean): number {
  if (peers.length === 0) return 100;
  const min = Math.min(...peers);
  const max = Math.max(...peers);
  if (min === max) return 100;
  const ratio = (value - min) / (max - min);
  const score = lowerIsBetter ? 1 - ratio : ratio;
  return Math.round(score * 100);
}

export type ScorePart = {
  key: keyof Weights;
  score: number | null;
  weight: number;
};

export function overallScore(parts: ScorePart[]): number | null {
  const known = parts.filter((part) => part.score != null && part.weight > 0);
  const totalWeight = known.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return null;
  const value = known.reduce((sum, part) => sum + ((part.score ?? 0) * part.weight) / totalWeight, 0);
  return Math.round(value * 10) / 10;
}

function strip(input: Partial<Weights> | null | undefined): Partial<Weights> {
  if (!input) return {};
  const next: Partial<Weights> = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) next[key] = value;
  }
  return next;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
