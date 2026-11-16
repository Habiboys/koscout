export const LISTING_SOURCES = [
  { id: "mamikos", label: "Mamikos", hosts: ["mamikos.com"] },
  { id: "rukita", label: "Rukita", hosts: ["rukita.co"] },
  { id: "cove", label: "Cove", hosts: ["cove.id"] },
  { id: "infokost", label: "Infokost", hosts: ["infokost.id"] },
  { id: "olx", label: "OLX", hosts: ["olx.co.id"] },
] as const;

export const SOURCE_FILTERS = [
  ...LISTING_SOURCES.map((source) => ({ id: source.id, label: source.label })),
  { id: "other", label: "Situs lain" },
  { id: "manual", label: "Tempel manual" },
  { id: "contoh", label: "Contoh" },
] as const;

export function describeSource(
  sourceName: string | null | undefined,
  sourceUrl: string | null | undefined,
): { id: string; label: string } {
  if (sourceName === "contoh") return { id: "contoh", label: "Contoh" };
  if (sourceName === "manual") return { id: "manual", label: "Tempel manual" };
  const picked = LISTING_SOURCES.find((source) => source.id === sourceName);
  if (picked) return { id: picked.id, label: picked.label };

  const host = hostname(sourceUrl) || hostnameFromName(sourceName);
  const known = LISTING_SOURCES.find((source) =>
    source.hosts.some((item) => host === item || host.endsWith(`.${item}`)),
  );
  if (known) return { id: known.id, label: known.label };
  if (!host) return { id: "manual", label: "Tempel manual" };
  return { id: "other", label: host };
}

export function sourceKey(sourceName: string | null | undefined, sourceUrl: string | null | undefined): string {
  const source = describeSource(sourceName, sourceUrl);
  return source.id === "other" ? source.label : source.id;
}

export function matchesSource(
  filter: string | null,
  sourceName: string | null | undefined,
  sourceUrl: string | null | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  return describeSource(sourceName, sourceUrl).id === filter;
}

function hostname(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostnameFromName(value: string | null | undefined): string {
  if (!value || !value.includes(".")) return "";
  return value.replace(/^www\./, "").toLowerCase();
}
