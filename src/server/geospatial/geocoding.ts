import { prisma } from "@/server/db";

let lastRequestAt = 0;

export type GeocodeHit = {
  latitude: number;
  longitude: number;
  label: string;
};

export async function geocodeAddress(query: string): Promise<GeocodeHit | null> {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  const cached = await prisma.geocodeCache.findUnique({ where: { query: normalized } });
  if (cached) {
    if (cached.latitude == null || cached.longitude == null) {
      return null;
    }
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      label: cached.label ?? query.trim(),
    };
  }

  await pace();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "id");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": process.env.NOMINATIM_USER_AGENT ?? "KosFinder/0.1 (personal local use)",
        Accept: "application/json",
        "Accept-Language": "id",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = data[0];
    if (!first?.lat || !first.lon) {
      await prisma.geocodeCache.create({ data: { query: normalized } });
      return null;
    }
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const label = first.display_name ?? query.trim();
    await prisma.geocodeCache.create({
      data: { query: normalized, latitude, longitude, label },
    });
    return { latitude, longitude, label };
  } catch {
    return null;
  }
}

async function pace(): Promise<void> {
  const wait = 1100 - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}
