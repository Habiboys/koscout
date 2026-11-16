import { listingInputSchema } from "@/lib/validations";
import { getListing, updateListing } from "@/server/listings";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) return jsonError("Kos tidak ditemukan.", 404);
  return Response.json({ listing });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = listingInputSchema.safeParse(body);
  if (!parsed.success) return jsonError("Perubahan tidak valid.");
  const listing = await updateListing(id, parsed.data);
  if (!listing) return jsonError("Kos tidak ditemukan.", 404);
  return Response.json({ listing });
}
