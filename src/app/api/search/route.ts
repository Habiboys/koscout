import { readSearchFilters } from "@/server/search-params";
import { searchListings } from "@/server/listings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const filters = readSearchFilters(new URL(request.url).searchParams);
  return Response.json(await searchListings(filters));
}
