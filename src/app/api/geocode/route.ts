import { geocodeSchema } from "@/lib/validations";
import { geocodeAddress } from "@/server/geospatial/geocoding";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = geocodeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Alamat terlalu pendek.");
  }
  const hit = await geocodeAddress(parsed.data.query);
  if (!hit) {
    return jsonError("Alamat tidak ditemukan. Pasang titiknya langsung di peta.", 404);
  }
  return Response.json(hit);
}
