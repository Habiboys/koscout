import { z } from "zod";
import { resolvePlace } from "@/server/geospatial/resolve-place";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().trim().min(3).max(2000),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Tempel tautan peta atau koordinat.");
  const place = await resolvePlace(parsed.data.text);
  if (!place) return jsonError("Koordinat tidak ketemu. Coba tautan Google Maps yang berisi pin, atau klik peta.", 404);
  return Response.json(place);
}
