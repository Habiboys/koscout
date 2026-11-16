export type ParsedPlace = {
  latitude: number;
  longitude: number;
  label: string;
  name: string | null;
};

const DECIMAL = String.raw`[+-]?\d{1,3}\.\d{3,}`;

export function parseMapLink(input: string): ParsedPlace | null {
  const text = input.trim();
  if (!text) return null;
  const name = placeName(text);
  const decoded = decode(text);

  const pin = decoded.match(new RegExp(`!3d(${DECIMAL})!4d(${DECIMAL})`));
  if (pin) return place(pin[1], pin[2], name ?? labelFrom(text));

  const at = decoded.match(new RegExp(`@(${DECIMAL}),(${DECIMAL})`));
  if (at) return place(at[1], at[2], name ?? labelFrom(text));

  const query = decoded.match(
    new RegExp(`(?:[?&#]|^)(?:q|query|ll|sll|center|daddr|destination)=(${DECIMAL})\\s*,\\s*(${DECIMAL})`, "i"),
  );
  if (query) return place(query[1], query[2], name ?? labelFrom(text));

  const osmPoint = decoded.match(new RegExp(`mlat=(${DECIMAL}).*?mlon=(${DECIMAL})`, "i"));
  if (osmPoint) return place(osmPoint[1], osmPoint[2], name ?? "OpenStreetMap");

  const osmHash = decoded.match(new RegExp(`#map=\\d+/(${DECIMAL})/(${DECIMAL})`));
  if (osmHash) return place(osmHash[1], osmHash[2], name ?? "OpenStreetMap");

  const bare = decoded.match(new RegExp(`^\\s*(${DECIMAL})\\s*[, ]\\s*(${DECIMAL})\\s*$`));
  if (bare) return place(bare[1], bare[2], `${bare[1]}, ${bare[2]}`);

  const loose = decoded.match(new RegExp(`(${DECIMAL})\\s*[,/]\\s*(${DECIMAL})`));
  if (loose && /maps|openstreetmap|goo\.gl|koordinat/i.test(decoded)) {
    return place(loose[1], loose[2], name ?? labelFrom(text));
  }

  return null;
}

export function mapUrl(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  return match[0].replace(/[),.;]+$/, "");
}

export function placeName(input: string): string | null {
  const url = mapUrl(input) ?? input;
  const match = url.match(/\/place\/([^/?#]+)/i);
  if (!match) return null;
  const name = decode(match[1]).replace(/\+/g, " ").replace(/-/g, " ").trim();
  return name.length > 1 ? name : null;
}

function place(latitudeText: string, longitudeText: string, label: string): ParsedPlace | null {
  const first = Number(latitudeText);
  const second = Number(longitudeText);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  const swapped = Math.abs(first) > 90 && Math.abs(second) <= 90;
  const latitude = swapped ? second : first;
  const longitude = swapped ? first : second;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude, label, name: placeName(label) ?? (label.startsWith("http") ? null : label) };
}

function labelFrom(input: string): string {
  return placeName(input) ?? input.trim().slice(0, 180);
}

function decode(value: string): string {
  const plus = value.replace(/\+/g, " ");
  try {
    return decodeURIComponent(plus);
  } catch {
    return plus;
  }
}
