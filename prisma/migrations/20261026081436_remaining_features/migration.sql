-- AlterTable
ALTER TABLE "RouteCache" ADD COLUMN "geometry" TEXT;

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisitNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "checks" TEXT NOT NULL DEFAULT '{}',
    "note" TEXT,
    "photoUrls" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisitNote_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NearbySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NearbySnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AiTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IsochroneCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "geojson" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "locationQuality" TEXT NOT NULL DEFAULT 'unknown',
    "gender" TEXT NOT NULL DEFAULT 'unknown',
    "priceAmount" INTEGER,
    "priceRaw" TEXT,
    "pricePeriod" TEXT,
    "isStartingPrice" BOOLEAN NOT NULL DEFAULT false,
    "extraFeesNote" TEXT,
    "facilities" TEXT NOT NULL DEFAULT '[]',
    "availability" TEXT NOT NULL DEFAULT 'unknown',
    "description" TEXT,
    "rawText" TEXT,
    "completeness" REAL NOT NULL DEFAULT 0,
    "roomSizeM2" REAL,
    "depositAmount" INTEGER,
    "adminFee" INTEGER,
    "movingFee" INTEGER,
    "electricityStatus" TEXT NOT NULL DEFAULT 'unknown',
    "electricityMonthly" INTEGER,
    "internetStatus" TEXT NOT NULL DEFAULT 'unknown',
    "internetMonthly" INTEGER,
    "laundryMonthly" INTEGER,
    "otherMonthly" INTEGER,
    "lastCheckedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Listing" ("address", "availability", "completeness", "createdAt", "description", "extraFeesNote", "facilities", "gender", "id", "isStartingPrice", "lastCheckedAt", "latitude", "locationQuality", "longitude", "name", "priceAmount", "pricePeriod", "priceRaw", "rawText", "sourceName", "sourceUrl", "updatedAt") SELECT "address", "availability", "completeness", "createdAt", "description", "extraFeesNote", "facilities", "gender", "id", "isStartingPrice", "lastCheckedAt", "latitude", "locationQuality", "longitude", "name", "priceAmount", "pricePeriod", "priceRaw", "rawText", "sourceName", "sourceUrl", "updatedAt" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
CREATE UNIQUE INDEX "Listing_sourceUrl_key" ON "Listing"("sourceUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_listingId_key" ON "Favorite"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitNote_listingId_key" ON "VisitNote"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "NearbySnapshot_listingId_key" ON "NearbySnapshot"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "IsochroneCache_cacheKey_key" ON "IsochroneCache"("cacheKey");
