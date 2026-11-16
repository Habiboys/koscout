import { refreshListingFromSource } from "@/server/import/refresh-listing";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const record = await refreshListingFromSource(id);
    return Response.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui dari situs asli.";
    return jsonError(message);
  }
}
