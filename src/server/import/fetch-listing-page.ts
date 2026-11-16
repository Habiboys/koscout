const ALLOWED_HOSTS = ["rukita.co", "mamikos.com"];
const MAX_BYTES = 2_000_000;

export function allowedListingUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!ALLOWED_HOSTS.includes(host)) return null;
  if (host === "mamikos.com" && !url.pathname.startsWith("/room/")) return null;
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
  return url;
}

export async function fetchListingPage(value: string): Promise<string> {
  const start = allowedListingUrl(value);
  if (!start) {
    throw new Error("Tautan ini belum bisa dibaca. Yang tersedia sekarang halaman daftar Rukita, misalnya https://www.rukita.co/kost/bandung.");
  }
  let current = start;
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        Accept: "text/html",
        "User-Agent": "KosFinder/0.1 (personal listing import)",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Halaman berpindah tanpa tujuan.");
      const next = allowedListingUrl(new URL(location, current).toString());
      if (!next) throw new Error("Halaman berpindah ke situs yang tidak dibaca.");
      current = next;
      continue;
    }
    if (!response.ok) {
      throw new Error(`Halaman membalas ${response.status}.`);
    }
    const html = await response.text();
    if (html.length > MAX_BYTES) {
      return html.slice(0, MAX_BYTES);
    }
    return html;
  }
  throw new Error("Terlalu banyak pindahan halaman.");
}
