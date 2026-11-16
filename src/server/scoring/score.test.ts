import { describe, expect, it } from "vitest";
import { monthlyCost, transportMonthlyCost } from "@/server/cost/monthly-cost";
import { overallScore, relativeScore } from "@/server/scoring/weights";
import { scoreListings } from "@/server/scoring/score";
import { DEFAULT_WEIGHTS } from "@/server/scoring/weights";

describe("skor berbobot", () => {
  it("memberi nilai lebih tinggi pada harga dan waktu yang lebih kecil", () => {
    expect(relativeScore(1_000_000, [1_000_000, 2_000_000], true)).toBe(100);
    expect(relativeScore(2_000_000, [1_000_000, 2_000_000], true)).toBe(0);
  });

  it("tidak menghitung komponen yang belum diketahui sebagai nol", () => {
    const overall = overallScore([
      { key: "price", score: 80, weight: 25 },
      { key: "commute", score: null, weight: 30 },
      { key: "facilities", score: 60, weight: 20 },
      { key: "nearby", score: null, weight: 15 },
      { key: "transport", score: null, weight: 10 },
    ]);
    expect(overall).toBeCloseTo((80 * 25 + 60 * 20) / 45, 1);
  });

  it("mengurutkan kos yang lebih murah dan lebih dekat lebih tinggi", () => {
    const scores = scoreListings(
      [
        { id: "a", priceAmount: 1_000_000, durationSeconds: 600, facilities: ["ac", "wifi"], nearbyScore: null, transportScore: null },
        { id: "b", priceAmount: 2_000_000, durationSeconds: 1800, facilities: ["wifi"], nearbyScore: null, transportScore: null },
      ],
      DEFAULT_WEIGHTS,
    );
    expect(scores.get("a")?.overall ?? 0).toBeGreaterThan(scores.get("b")?.overall ?? 0);
    expect(scores.get("a")?.nearby).toBeNull();
  });
});

describe("biaya bulanan", () => {
  it("tidak menganggap listrik yang belum diketahui sebagai gratis", () => {
    const result = monthlyCost({
      rent: 1_500_000,
      electricityStatus: "unknown",
      electricityMonthly: null,
      internetStatus: "included",
      internetMonthly: null,
      laundryMonthly: 100_000,
      otherMonthly: 0,
      transportMonthly: 200_000,
      depositAmount: 1_500_000,
      adminFee: 0,
      movingFee: 0,
    });
    expect(result.monthly).toBeNull();
    expect(result.missing).toContain("listrik");
  });

  it("menjumlahkan biaya yang sudah diketahui dan proyeksi", () => {
    const result = monthlyCost({
      rent: 1_600_000,
      electricityStatus: "included",
      electricityMonthly: null,
      internetStatus: "included",
      internetMonthly: null,
      laundryMonthly: 150_000,
      otherMonthly: 0,
      transportMonthly: 100_000,
      depositAmount: 1_600_000,
      adminFee: 0,
      movingFee: 200_000,
      });
    expect(result.monthly).toBe(1_850_000);
    expect(result.projections.find((item) => item.months === 12)?.total).toBe(1_850_000 * 12 + 1_800_000);
  });

  it("menghitung biaya motor dari jarak pulang pergi", () => {
    expect(transportMonthlyCost(5, "motorcycle")).toBe(Math.round(10 * 800 * 22));
  });
});
