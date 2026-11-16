import { listingInputSchema } from "@/lib/validations";
import { saveListing } from "@/server/listings";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = listingInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Data kos belum lengkap atau tidak valid.");
  }
  const result = await saveListing(parsed.data);
  return Response.json(result);
}
