import { mapUrl, parseMapLink, placeName, type ParsedPlace } from "@/lib/map-link";
import { geocodeAddress } from "@/server/geospatial/geocoding";

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

export async function resolvePlace(input: string): Promise<ParsedPlace | null> {
  const direct = parseMapLink(input);
  if (direct) return direct;

  const url = mapUrl(input);
  if (url && isShortMapUrl(url)) {
    const expanded = await expandMapUrl(url);
    if (expanded) {
      const parsed = parseMapLink(expanded);
      if (parsed) return parsed;
    }
  }

  const named = url ? placeName(url) : null;
  const query = named ?? (url ? null : input.trim());
  if (!query || query.length < 3) return null;
  const hit = await geocodeAddress(query);
  if (!hit) return null;
  return { latitude: hit.latitude, longitude: hit.longitude, label: hit.label, name: named ?? hit.label.split(",")[0] ?? null };
}

function isShortMapUrl(value: string): boolean {
  try {
    return SHORT_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function expandMapUrl(start: string): Promise<string | null> {
  let current = start;
  for (let hop = 0; hop < 5; hop += 1) {
    const url = parseHttps(current);
    if (!url || !allowedMapHost(url)) return null;
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        Accept: "text/html",
        "User-Agent": "KosFinder/0.1 (personal map link resolver)",
      },
      signal: AbortSignal.timeout(8000),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) return current;
    const snippet = (await response.text()).slice(0, 20000).replace(/&amp;/g, "&");
    const embedded = snippet.match(/https:\/\/(?:www\.)?(?:google(?:\.[a-z.]+)?\/maps|openstreetmap\.org)\/[^"'\\\s<]+/i);
    return embedded?.[0] ?? current;
  }
  return current;
}

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function allowedMapHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
  return (
    SHORT_HOSTS.has(host) ||
    host === "maps.apple.com" ||
    host === "openstreetmap.org" ||
    host === "www.openstreetmap.org" ||
    host.endsWith(".google.com") ||
    host.endsWith(".google.co.id") ||
    host === "google.com" ||
    host === "google.co.id"
  );
}
