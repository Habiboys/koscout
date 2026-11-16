import { z } from "zod";
import { importCapturedPage } from "@/server/import/import-capture";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  sourceUrl: z.string().trim().url().max(2000),
  title: z.string().trim().max(300).optional(),
  cards: z
    .array(
      z.object({
        html: z.string().max(12000),
        href: z.string().max(2000).nullable(),
        text: z.string().max(2000),
        images: z.array(z.string().max(2000)).max(3),
      }),
    )
    .max(1000),
  pageHtml: z.string().max(400_000).nullable().optional(),
  latitude: z.number().gte(-90).lte(90).nullable().optional(),
  longitude: z.number().gte(-180).lte(180).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Data halaman tidak valid.");
  }
  try {
    const result = await importCapturedPage({
      sourceUrl: parsed.data.sourceUrl,
      title: parsed.data.title ?? "",
      cards: parsed.data.cards,
      pageHtml: parsed.data.pageHtml,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Halaman tidak bisa disimpan.";
    return jsonError(message);
  }
}
