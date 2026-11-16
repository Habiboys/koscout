import { z } from "zod";
import { getActiveOffice } from "@/server/listings";
import { getIsochrone } from "@/server/geospatial/isochrone";
import { routeProviderName } from "@/server/geospatial/routing";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  minutes: z.number().int().min(5).max(60),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Menit tempuh tidak valid.");
  const office = await getActiveOffice();
  if (!office) return jsonError("Pasang titik kantor dulu.");
  const polygon = await getIsochrone({
    latitude: office.latitude,
    longitude: office.longitude,
    minutes: parsed.data.minutes,
  });
  if (!polygon) return jsonError(`Area waktu tempuh belum bisa dihitung. ${routeProviderName()} tidak menjawab.`, 503);
  return Response.json({ polygon, note: `Perkiraan ${routeProviderName()} tanpa data kemacetan.` });
}
