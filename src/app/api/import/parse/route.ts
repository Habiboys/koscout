import { parseTextSchema } from "@/lib/validations";
import { parseListing } from "@/server/normalization/parse-listing";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseTextSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Teks listing tidak valid.");
  }
  return Response.json(parseListing(parsed.data.text));
}
