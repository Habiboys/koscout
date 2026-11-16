export function matchesListingQuery(name: string, address: string | null | undefined, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${name} ${address ?? ""}`.toLowerCase();
  if (haystack.includes(needle)) return true;
  const words = needle.split(/[^a-z0-9]+/).filter((word) => word.length > 1);
  if (words.length === 0) return haystack.includes(needle);
  return words.every((word) => haystack.includes(word));
}
