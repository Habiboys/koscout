import { describe, expect, it } from "vitest";
import { parseFacilities } from "@/lib/facilities";
import { completenessScore } from "./completeness";
import { parseAvailability, parseGender } from "./normalize-facilities";
import { parseListing } from "./parse-listing";

describe("fasilitas dan jenis kos", () => {
  it("mengenali fasilitas wajib dan menolak yang dinegasi", () => {
    const facilities = parseFacilities(
      "AC, Wi-Fi, kamar mandi dalam, parkir motor, dapur. Tidak ada kulkas.",
    );
    expect(facilities).toEqual([
      "ac",
      "wifi",
      "private_bathroom",
      "motorcycle_parking",
      "kitchen",
    ]);
  });

  it("tidak menghitung AC yang disebut sebagai tidak ada", () => {
    expect(parseFacilities("tidak ada AC, ada WiFi dan km. luar")).toEqual([
      "wifi",
      "shared_bathroom",
    ]);
  });

  it("membaca jenis kos", () => {
    expect(parseGender("Kos putri dekat kantor")).toBe("putri");
    expect(parseGender("khusus putra")).toBe("putra");
    expect(parseGender("putra/putri")).toBe("campur");
    expect(parseGender("kos campur")).toBe("campur");
    expect(parseGender("dekat halte")).toBe("unknown");
  });

  it("membaca ketersediaan dari penyebutan terakhir", () => {
    expect(parseAvailability("Dulu penuh, sekarang tersedia")).toBe("available");
    expect(parseAvailability("Kamar sudah penuh")).toBe("full");
  });
});

describe("kelengkapan", () => {
  it("menghitung bagian data yang terisi", () => {
    expect(
      completenessScore({
        name: "Kos Melati",
        priceAmount: 1_000_000,
        latitude: -6.2,
        longitude: 106.8,
        gender: "putri",
        facilities: ["ac"],
        address: "Jakarta",
      }),
    ).toBe(1);
    expect(
      completenessScore({
        name: "Kos",
        gender: "unknown",
        facilities: [],
      }),
    ).toBeCloseTo(1 / 6);
  });
});

describe("parseListing", () => {
  it("menormalkan teks listing dan JSON bookmarklet", () => {
    const parsed = parseListing(`Kos Melati Residence
Jl. Kapten Tendean No. 12, Jakarta Selatan
Kos putri
Rp1.750.000/bulan
Fasilitas: AC, Wi-Fi, kamar mandi dalam, parkir motor
Listrik ditanggung sendiri.
Kamar tersedia.
https://example.com/kos-melati`);

    expect(parsed.name).toMatch(/Melati/);
    expect(parsed.priceAmount).toBe(1_750_000);
    expect(parsed.gender).toBe("putri");
    expect(parsed.facilities).toContain("private_bathroom");
    expect(parsed.sourceUrl).toBe("https://example.com/kos-melati");
    expect(parsed.availability).toBe("available");
    expect(parsed.address).toMatch(/Tendean/);

    const fromBookmarklet = parseListing(
      JSON.stringify({
        sourceUrl: "https://mamikos.example/room/1",
        name: "Kos Bookmark",
        rawText: "Kos putra\nRp900.000/bulan\nWi-Fi",
      }),
    );
    expect(fromBookmarklet.name).toBe("Kos Bookmark");
    expect(fromBookmarklet.priceAmount).toBe(900_000);
    expect(fromBookmarklet.gender).toBe("putra");
    expect(fromBookmarklet.sourceName).toBe("mamikos.example");
  });

  it("menyimpan tautan gambar dan mengabaikan URL yang bukan foto", () => {
    const parsed = parseListing(
      JSON.stringify({
        sourceUrl: "https://example.com/kos-foto",
        name: "Kos Foto",
        rawText: "Kos putri\nRp1.000.000/bulan\nhttps://cdn.example.com/kamar.jpg",
        imageUrls: ["https://cdn.example.com/depan.webp", "https://example.com/bukan-foto"],
      }),
    );
    expect(parsed.imageUrls).toEqual(["https://cdn.example.com/depan.webp", "https://cdn.example.com/kamar.jpg"]);
    expect(parsed.sourceUrl).toBe("https://example.com/kos-foto");
  });
});
