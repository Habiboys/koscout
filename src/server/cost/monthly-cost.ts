export type CostInput = {
  rent: number | null;
  electricityStatus: string;
  electricityMonthly: number | null;
  internetStatus: string;
  internetMonthly: number | null;
  laundryMonthly: number | null;
  otherMonthly: number | null;
  transportMonthly: number | null;
  depositAmount: number | null;
  adminFee: number | null;
  movingFee: number | null;
};

export type CostResult = {
  monthly: number | null;
  upfront: number | null;
  missing: string[];
  projections: { months: number; total: number | null }[];
};

export function monthlyCost(input: CostInput): CostResult {
  const missing: string[] = [];
  if (input.rent == null) missing.push("sewa");
  const electricity = knownFee(input.electricityStatus, input.electricityMonthly, "listrik", missing);
  const internet = knownFee(input.internetStatus, input.internetMonthly, "internet", missing);
  const laundry = optionalNumber(input.laundryMonthly, "laundry", missing);
  const other = optionalNumber(input.otherMonthly, "biaya lain", missing);
  const transport = optionalNumber(input.transportMonthly, "transport", missing);

  const upfrontParts = [input.depositAmount, input.adminFee, input.movingFee];
  const upfrontKnown = upfrontParts.every((value) => value != null);
  const upfront = upfrontKnown ? upfrontParts.reduce((sum: number, value) => sum + (value ?? 0), 0) : null;
  if (!upfrontKnown) missing.push("biaya awal");

  const recurring = [input.rent, electricity, internet, laundry, other, transport];
  const monthly = missing.some((item) => item !== "biaya awal") || recurring.some((value) => value == null)
    ? null
    : recurring.reduce((sum: number, value) => sum + (value ?? 0), 0);

  return {
    monthly,
    upfront,
    missing: [...new Set(missing)],
    projections: [3, 6, 12].map((months) => ({
      months,
      total: monthly == null ? null : monthly * months + (upfront ?? 0),
    })),
  };
}

export function transportMonthlyCost(distanceKm: number | null, mode: string): number | null {
  if (distanceKm == null) return null;
  const perKm = mode === "car" ? 1500 : mode === "motorcycle" || mode === "driving" ? 800 : mode === "transit" ? 0 : 0;
  const dailyFlat = mode === "transit" ? 7000 : 0;
  const roundTripKm = distanceKm * 2;
  return Math.round((roundTripKm * perKm + dailyFlat) * 22);
}

function knownFee(status: string, amount: number | null, label: string, missing: string[]): number | null {
  if (status === "included") return 0;
  if (status === "excluded" && amount != null) return amount;
  missing.push(label);
  return null;
}

function optionalNumber(value: number | null, label: string, missing: string[]): number | null {
  if (value == null) {
    missing.push(label);
    return null;
  }
  return value;
}
