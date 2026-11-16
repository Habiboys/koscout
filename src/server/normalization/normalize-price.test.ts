import { describe, expect, it } from "vitest";
import { parseIdrToken, parsePrice } from "./normalize-price";

describe("parsePrice", () => {
  it("membaca harga bulanan dengan pemisah ribuan", () => {
    const result = parsePrice("Sewa Rp1.500.000/bulan");
    expect(result.priceAmount).toBe(1_500_000);
    expect(result.pricePeriod).toBe("month");
    expect(result.isStartingPrice).toBe(false);
  });

  it("mengubah harga harian menjadi estimasi 30 hari", () => {
    const result = parsePrice("Rp 50.000/hari");
    expect(result.priceAmount).toBe(1_500_000);
    expect(result.pricePeriod).toBe("day");
    expect(result.estimateNote).toMatch(/×30/);
  });

  it("mengubah harga tahunan menjadi estimasi bulanan", () => {
    const result = parsePrice("Rp18.000.000/tahun");
    expect(result.priceAmount).toBe(1_500_000);
    expect(result.pricePeriod).toBe("year");
  });

  it("menandai harga mulai dari", () => {
    const result = parsePrice("mulai dari Rp1.200.000 per bulan");
    expect(result.priceAmount).toBe(1_200_000);
    expect(result.isStartingPrice).toBe(true);
  });

  it("membaca singkatan juta dan ribu", () => {
    expect(parsePrice("1,5 jt").priceAmount).toBe(1_500_000);
    expect(parsePrice("500rb/bulan").priceAmount).toBe(500_000);
  });

  it("tidak memakai angka deposit sebagai harga sewa", () => {
    const result = parsePrice("Sewa Rp2.000.000/bulan. Deposit Rp1.000.000.");
    expect(result.priceAmount).toBe(2_000_000);
    expect(result.extraFeesNote).toMatch(/Deposit/i);
  });

  it("tidak mengarang harga bulanan bila periode tidak jelas dan angkanya kecil", () => {
    const result = parsePrice("Biaya Rp50.000");
    expect(result.priceAmount).toBeNull();
    expect(result.pricePeriod).toBe("unknown");
  });
});

describe("parseIdrToken", () => {
  it("memahami pemisah ribuan Indonesia", () => {
    expect(parseIdrToken("1.500.000", null)).toBe(1_500_000);
    expect(parseIdrToken("1,5", "jt")).toBe(1_500_000);
  });
});
