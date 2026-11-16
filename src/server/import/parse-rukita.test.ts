import { describe, expect, it } from "vitest";
import { allowedListingUrl } from "@/server/import/fetch-listing-page";
import { parseRukitaSearch, readRukitaPlace } from "@/server/import/parse-rukita";

const CARD = `
<a data-testid="AssetCard" href="/place/uma-kost-aranda-dago-bandung">
  <span itemProp="name">Uma Kost Aranda Dago Bandung</span>
  <span itemProp="streetAddress">Jl Dago pojok 44A, Dago Kel Coblong Bandung Kota</span>
  <span itemProp="addressLocality">Bandung</span>
  <span itemProp="priceRange">Rp 1.668.000 - Rp 2.118.000</span>
  <img src="https://images.rukita.co/ais/depan.jpg" />
  Coliving • Campur
  Dago, Coblong
  1.1 km dari Institut Teknologi Bandung (ITB)
  mulai dari Rp1.668.000 /bulan
</a>
<a data-testid="AssetCard" href="/place/rukita-dago-living-putri">
  <span itemProp="name">Rukita Dago Living Putri Bandung 9</span>
  <span itemProp="streetAddress">Jl. Dago Timur No. 9, Dago</span>
  <span itemProp="addressLocality">Bandung</span>
  <span itemProp="priceRange">Rp 3.536.000</span>
  Coliving • Putri
  mulai dari Rp3.536.000 /bulan
  Diskon sewa min. 12 Bulan
</a>
`;

describe("parseRukitaSearch", () => {
  it("reads the cards on a city page", () => {
    const cards = parseRukitaSearch(CARD, "https://www.rukita.co/kost/bandung");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      name: "Uma Kost Aranda Dago Bandung",
      sourceUrl: "https://www.rukita.co/place/uma-kost-aranda-dago-bandung",
      gender: "campur",
      priceAmount: 1_668_000,
      isStartingPrice: true,
      address: "Jl Dago pojok 44A, Dago Kel Coblong Bandung Kota",
      imageUrls: ["https://images.rukita.co/ais/depan.jpg"],
    });
    expect(cards[1]?.gender).toBe("putri");
    expect(cards[1]?.note).toMatch(/diskon/i);
  });
});

describe("allowedListingUrl", () => {
  it("keeps Rukita city pages and Mamikos room pages", () => {
    expect(allowedListingUrl("https://www.rukita.co/kost/bandung")?.pathname).toBe("/kost/bandung");
    expect(allowedListingUrl("https://mamikos.com/room/pondok-teratai")?.pathname).toBe("/room/pondok-teratai");
    expect(allowedListingUrl("http://www.rukita.co/kost/bandung")).toBeNull();
    expect(allowedListingUrl("https://mamikos.com/cari/upi")).toBeNull();
    expect(allowedListingUrl("https://127.0.0.1/kost/bandung")).toBeNull();
  });
});

describe("readRukitaPlace", () => {
  it("reads the published pin, room size, deposit, and facilities", () => {
    const place = readRukitaPlace(`
      "geo":{"@type":"GeoCoordinates","latitude":"-6.883246","longitude":"107.616705"}
      Fasilitas yang tersedia meliputi Wifi, Parkir Motor, Dapur
      Deposit sebesar Rp500.000
      Termasuk Listrik: Tidak
      <div data-testid="AssetVariantItem">8.5 m² Kamar Mandi Dalam AC</div>
    `);
    expect(place.latitude).toBeCloseTo(-6.883246);
    expect(place.longitude).toBeCloseTo(107.616705);
    expect(place.roomSizeM2).toBe(8.5);
    expect(place.depositAmount).toBe(500_000);
    expect(place.gender).toBe("unknown");
    expect(place.electricityStatus).toBe("excluded");
    expect(place.facilities).toEqual(["ac", "wifi", "private_bathroom", "motorcycle_parking", "kitchen"]);
  });

  it("reads putra, putri, or campur from the place page", () => {
    expect(readRukitaPlace(`Coliving • Putra`).gender).toBe("putra");
    expect(readRukitaPlace(`Kost Putri dekat kampus`).gender).toBe("putri");
  });
});
