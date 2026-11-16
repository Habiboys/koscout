-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Listing" (
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
    "lastCheckedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "label" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RouteCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'osrm',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_sourceUrl_key" ON "Listing"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "GeocodeCache_query_key" ON "GeocodeCache"("query");

-- CreateIndex
CREATE UNIQUE INDEX "RouteCache_cacheKey_key" ON "RouteCache"("cacheKey");
