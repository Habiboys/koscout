import { z } from "zod";
import { importSelectedSources } from "@/server/import/import-search";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  sources: z.array(z.enum(["rukita", "mamikos"])).min(1).max(5),
  city: z.literal("bandung"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Pilih minimal satu sumber.");
  }
  const results = await importSelectedSources(parsed.data.sources, parsed.data.city);
  return Response.json({ city: parsed.data.city, results });
}
