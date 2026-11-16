import { buildExport, buildPrompt } from "@/server/export/build-export";
import { buildMarkdown } from "@/server/export/markdown";
import { enrichListings } from "@/server/enrich";
import { attachCommute, getActiveOffice, getListingsByIds } from "@/server/listings";
import { readIdList, readSearchFilters } from "@/server/search-params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = readSearchFilters(url.searchParams);
  const ids = readIdList(url.searchParams);
  const office = await getActiveOffice();
  const routed = await attachCommute(await getListingsByIds(ids), office);
  const enriched = await enrichListings(routed);
  const listings = routed.map((listing) => ({
    ...listing,
    scores: enriched.scores[listing.id] ?? null,
    nearbyReport: enriched.nearby[listing.id] ?? null,
  }));
  const data = buildExport({
    office,
    listings,
    weights: enriched.weights,
    preferences: {
      maxBudget: filters.maxBudget,
      maxCommuteMinutes: filters.maxMinutes,
      requiredFacilities: filters.facilities,
    },
  });

  if (url.searchParams.get("format") === "markdown") {
    return new Response(
      buildMarkdown({
        officeName: office?.name ?? null,
        listings: listings.map((listing) => ({
          ...listing,
          nearbySummary: listing.nearbyReport
            ? listing.nearbyReport.categories.map((item) => `${item.label} ${item.count}`).join(", ")
            : null,
        })),
      }),
      { headers: { "Content-Type": "text/markdown; charset=utf-8" } },
    );
  }

  if (url.searchParams.get("format") === "prompt") {
    return Response.json({ prompt: buildPrompt(data), json: data });
  }

  const body = JSON.stringify(data, null, 2);
  if (url.searchParams.get("download") === "1") {
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=koscout-perbandingan.json",
      },
    });
  }
  return Response.json(data);
}
