import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const office = {
  name: "Kantor Sudirman",
  address: "Jl. Jenderal Sudirman, Jakarta Selatan",
  latitude: -6.2088,
  longitude: 106.822,
};

const listings = [
  {
    name: "Kos Melati",
    sourceName: "contoh",
    sourceUrl: "https://example.com/kos-melati",
    address: "Jl. Kapten Tendean, Jakarta Selatan",
    latitude: -6.2147,
    longitude: 106.8186,
    locationQuality: "approximate",
    gender: "putri",
    priceAmount: 1_750_000,
    priceRaw: "Rp1.750.000/bulan",
    pricePeriod: "month",
    facilities: ["ac", "wifi", "private_bathroom", "motorcycle_parking"],
    availability: "available",
    extraFeesNote: "Listrik dan air ditanggung sendiri.",
    completeness: 1,
  },
  {
    name: "Kos Mawar",
    sourceName: "contoh",
    sourceUrl: "https://example.com/kos-mawar",
    address: "Jl. Bendungan Hilir, Jakarta Pusat",
    latitude: -6.2005,
    longitude: 106.8148,
    locationQuality: "approximate",
    gender: "putra",
    priceAmount: 1_300_000,
    priceRaw: "Rp1.300.000/bulan",
    pricePeriod: "month",
    facilities: ["wifi", "shared_bathroom"],
    availability: "available",
    extraFeesNote: null,
    completeness: 1,
  },
  {
    name: "Kos Anggrek",
    sourceName: "contoh",
    sourceUrl: "https://example.com/kos-anggrek",
    address: "Jl. Senopati, Jakarta Selatan",
    latitude: -6.2302,
    longitude: 106.8074,
    locationQuality: "approximate",
    gender: "campur",
    priceAmount: 2_100_000,
    priceRaw: "Rp2.100.000/bulan",
    pricePeriod: "month",
    facilities: ["ac", "wifi", "private_bathroom", "motorcycle_parking", "kitchen"],
    availability: "available",
    extraFeesNote: "Termasuk listrik.",
    completeness: 1,
  },
  {
    name: "Kos Dahlia",
    sourceName: "contoh",
    sourceUrl: "https://example.com/kos-dahlia",
    address: "Mampang Prapatan, Jakarta Selatan",
    latitude: -6.2425,
    longitude: 106.8255,
    locationQuality: "approximate",
    gender: "putra",
    priceAmount: 950_000,
    priceRaw: "Rp950.000/bulan",
    pricePeriod: "month",
    facilities: ["motorcycle_parking"],
    availability: "full",
    extraFeesNote: null,
    completeness: 1,
  },
  {
    name: "Kos Kenanga",
    sourceName: "contoh",
    sourceUrl: "https://example.com/kos-kenanga",
    address: "Jl. Casablanca, Jakarta Selatan",
    latitude: -6.2244,
    longitude: 106.8432,
    locationQuality: "exact",
    gender: "putri",
    priceAmount: 1_600_000,
    priceRaw: "Rp1.600.000/bulan",
    pricePeriod: "month",
    facilities: ["ac", "wifi", "private_bathroom"],
    availability: "available",
    extraFeesNote: "Deposit satu bulan.",
    completeness: 1,
  },
  {
    name: "Kos Flamboyan",
    sourceName: "contoh",
    sourceUrl: "https://example.com/kos-flamboyan",
    address: null,
    latitude: null,
    longitude: null,
    locationQuality: "unknown",
    gender: "unknown",
    priceAmount: 1_400_000,
    priceRaw: "Rp1.400.000",
    pricePeriod: "month",
    facilities: ["wifi"],
    availability: "unknown",
    extraFeesNote: null,
    completeness: 0.5,
  },
];

async function main() {
  await prisma.routeCache.deleteMany();
  await prisma.geocodeCache.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.office.deleteMany();

  await prisma.office.create({ data: office });

  for (const listing of listings) {
    await prisma.listing.create({
      data: {
        ...listing,
        facilities: JSON.stringify(listing.facilities),
        isStartingPrice: false,
        description: `${listing.name} adalah data contoh agar peta dan perbandingan bisa dicoba sebelum impor sungguhan.`,
        lastCheckedAt: new Date(),
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
