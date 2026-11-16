export type NearbyCategory = {
  id: string;
  label: string;
  count: number;
  nearestMeters: number | null;
};

export type NearbyReport = {
  categories: NearbyCategory[];
  nearbyScore: number | null;
  transportScore: number | null;
  waterwayMeters: number | null;
  source: "openstreetmap";
  note: string;
};

type Element = {
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const CATEGORIES: Array<{ id: string; label: string; match: (tags: Record<string, string>) => boolean }> = [
  { id: "food", label: "Tempat makan", match: (tags) => ["restaurant", "cafe", "fast_food", "food_court"].includes(tags.amenity ?? "") },
  { id: "shop", label: "Minimarket", match: (tags) => ["supermarket", "convenience", "marketplace"].includes(tags.shop ?? tags.amenity ?? "") },
  { id: "laundry", label: "Laundry", match: (tags) => tags.shop === "laundry" || tags.shop === "dry_cleaning" },
  { id: "atm", label: "ATM", match: (tags) => tags.amenity === "atm" || tags.amenity === "bank" },
  { id: "health", label: "Kesehatan", match: (tags) => ["pharmacy", "clinic", "hospital", "doctors"].includes(tags.amenity ?? "") },
  { id: "transit", label: "Transportasi umum", match: (tags) => tags.highway === "bus_stop" || tags.public_transport === "platform" || tags.public_transport === "station" || tags.railway === "station" || tags.station === "subway" || tags.amenity === "bus_station" },
  { id: "mall", label: "Mall", match: (tags) => tags.shop === "mall" || tags.leisure === "fitness_centre" },
];

export async function fetchNearby(latitude: number, longitude: number): Promise<NearbyReport | null> {
  const query = `
[out:json][timeout:20];
(
  nwr(around:1000,${latitude},${longitude})["amenity"~"restaurant|cafe|fast_food|pharmacy|clinic|hospital|doctors|bank|atm|bus_station|marketplace"];
  nwr(around:1000,${latitude},${longitude})["shop"~"supermarket|convenience|laundry|dry_cleaning|mall"];
  nwr(around:1000,${latitude},${longitude})["highway"="bus_stop"];
  nwr(around:1000,${latitude},${longitude})["railway"="station"];
  nwr(around:1000,${latitude},${longitude})["public_transport"~"station|platform"];
  nwr(around:1500,${latitude},${longitude})["waterway"~"river|canal|stream"];
);
out center 80;
`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": process.env.NOMINATIM_USER_AGENT ?? "KosFinder/0.1 (personal local use)",
      },
      body: query,
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { elements?: Element[] };
    return summarize(latitude, longitude, data.elements ?? []);
  } catch {
    return null;
  }
}

export function summarize(latitude: number, longitude: number, elements: Element[]): NearbyReport {
  const placed = elements
    .map((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat == null || lon == null || !element.tags) return null;
      return { tags: element.tags, meters: haversineMeters(latitude, longitude, lat, lon) };
    })
    .filter((item): item is { tags: Record<string, string>; meters: number } => item != null);

  const categories = CATEGORIES.map((category) => {
    const hits = placed.filter((item) => category.match(item.tags) && item.meters <= 1000);
    return {
      id: category.id,
      label: category.label,
      count: hits.length,
      nearestMeters: hits.length ? Math.min(...hits.map((item) => item.meters)) : null,
    };
  });

  const water = placed.filter((item) => /river|canal|stream/.test(item.tags.waterway ?? ""));
  const scored = categories.filter((item) => item.id !== "mall");
  const nearbyScore = Math.round(
    scored.reduce((sum, item) => sum + categoryPoints(item.count, item.nearestMeters), 0) / scored.length,
  );
  const transit = categories.find((item) => item.id === "transit");

  return {
    categories,
    nearbyScore,
    transportScore: transit ? categoryPoints(transit.count, transit.nearestMeters) : null,
    waterwayMeters: water.length ? Math.min(...water.map((item) => item.meters)) : null,
    source: "openstreetmap",
    note: "Perkiraan dari OpenStreetMap. Data warung, laundry, dan halte di Indonesia sering tidak lengkap, jadi ini bukan daftar lengkap.",
  };
}

function categoryPoints(count: number, nearest: number | null): number {
  if (count === 0 || nearest == null) return 0;
  const distanceScore = Math.max(0, 100 - nearest / 10);
  const countScore = Math.min(100, count * 20);
  return Math.round(distanceScore * 0.6 + countScore * 0.4);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
