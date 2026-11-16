import { notFound } from "next/navigation";
import { parseDetailMeta } from "@/lib/detail-meta";
import { ListingEditor } from "@/components/listings/listing-editor";
import { prisma } from "@/server/db";
import { refreshListingFromSource } from "@/server/import/refresh-listing";
import type { NearbyReport } from "@/server/nearby/overpass";
import { attachCommute, getActiveOffice, getListing } from "@/server/listings";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let listing = await getListing(id);
  if (!listing) notFound();

  const storedMeta = parseDetailMeta(listing.rawText);
  const staleMamikos = listing.sourceName === "mamikos" && storedMeta?.overviewCaptured !== true;
  if (
    (listing.sourceName === "mamikos" || listing.sourceName === "rukita") &&
    (!storedMeta || !listing.sourceUrl || staleMamikos)
  ) {
    try {
      const refreshed = await refreshListingFromSource(id);
      if (refreshed) listing = refreshed;
    } catch {
      // Keep existing record if offline or source temporarily unreachable
    }
  }

  const office = await getActiveOffice();
  const [withRoute] = await attachCommute([listing], office);
  const extra = await prisma.listing.findUnique({
    where: { id },
    include: { favorite: true, visit: true, nearby: true },
  });

  let nearby: NearbyReport | null = null;
  if (extra?.nearby?.payload) {
    try {
      nearby = JSON.parse(extra.nearby.payload) as NearbyReport;
    } catch {
      nearby = null;
    }
  }

  const checks = parseRecord(extra?.visit?.checks);
  const photoUrls = parseStringList(extra?.visit?.photoUrls);

  return (
    <div className="stack">
      <ListingEditor
        listing={withRoute}
        officeName={office?.name ?? null}
        officePoint={office ? { latitude: office.latitude, longitude: office.longitude } : null}
        favorite={extra?.favorite ? { status: extra.favorite.status, note: extra.favorite.note } : null}
        visit={extra?.visit ? { checks, note: extra.visit.note, photoUrls } : null}
        nearby={nearby}
      />
    </div>
  );
}

function parseRecord(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function parseStringList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
