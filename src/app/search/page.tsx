import { SearchStudio } from "@/components/search/search-studio";
import { enrichListings } from "@/server/enrich";
import { listOffices, searchListings } from "@/server/listings";
import { readSearchFilters } from "@/server/search-params";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  const filters = readSearchFilters(params);
  const result = await searchListings(filters);
  const enriched = await enrichListings([...result.matches, ...result.pendingCommute]);
  const offices = await listOffices();
  const queryKey = params.toString();

  return (
    <SearchStudio
      key={queryKey}
      filters={filters}
      office={
        result.office
          ? {
              id: result.office.id,
              name: result.office.name,
              address: result.office.address,
              latitude: result.office.latitude,
              longitude: result.office.longitude,
            }
          : null
      }
      offices={offices.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        isActive: item.isActive,
      }))}
      matches={result.matches}
      pendingCommute={result.pendingCommute}
      excludedIncomplete={result.excludedIncomplete}
      outsideArea={result.outsideArea}
      focusKm={result.focusKm}
      radiusIgnored={result.radiusIgnored}
      scores={enriched.scores}
      warnings={enriched.warnings}
    />
  );
}
