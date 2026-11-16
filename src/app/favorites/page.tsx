import { FavoritesBoard } from "@/components/favorites/favorites-board";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const favorites = await prisma.favorite.findMany({
    include: { listing: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <FavoritesBoard
      items={favorites.map((item) => ({
        id: item.id,
        listingId: item.listingId,
        name: item.listing.name,
        priceAmount: item.listing.priceAmount,
        status: item.status,
        note: item.note,
      }))}
    />
  );
}
