import { describe, expect, it } from "vitest";
import { parseMapLink } from "@/lib/map-link";

describe("parseMapLink", () => {
  it("mengambil pin Google Maps, bukan pusat layar", () => {
    const parsed = parseMapLink(
      "https://www.google.com/maps/place/Monumen+Nasional/@-6.1700,106.8200,17z/data=!3d-6.175392!4d106.827153",
    );
    expect(parsed?.latitude).toBeCloseTo(-6.175392, 5);
    expect(parsed?.longitude).toBeCloseTo(106.827153, 5);
    expect(parsed?.name).toBe("Monumen Nasional");
  });

  it("membaca koordinat di tautan @ dan parameter q", () => {
    expect(parseMapLink("https://www.google.com/maps/@-6.208800,106.822000,16z")?.latitude).toBeCloseTo(-6.2088);
    expect(parseMapLink("https://maps.google.com/?q=-6.214700,106.818600")?.longitude).toBeCloseTo(106.8186);
  });

  it("membaca OpenStreetMap dan angka polos", () => {
    expect(parseMapLink("https://www.openstreetmap.org/#map=17/-6.175400/106.827200")?.latitude).toBeCloseTo(-6.1754);
    expect(parseMapLink("-6.208800, 106.822000")?.longitude).toBeCloseTo(106.822);
  });

  it("menolak teks yang bukan koordinat", () => {
    expect(parseMapLink("Rp1.750.000 per bulan")).toBeNull();
    expect(parseMapLink("kantor sudirman")).toBeNull();
  });
});
