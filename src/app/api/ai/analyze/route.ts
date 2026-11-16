import { z } from "zod";
import { geminiAnalysis, geminiText } from "@/server/ai/gemini";
import { prisma } from "@/server/db";
import { buildExport } from "@/server/export/build-export";
import { enrichListings } from "@/server/enrich";
import { attachCommute, getActiveOffice, getListingsByIds } from "@/server/listings";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(10),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Pilih 1–10 kos untuk dianalisis.");
  const office = await getActiveOffice();
  const routed = await attachCommute(await getListingsByIds(parsed.data.ids), office);
  const enriched = await enrichListings(routed);
  const data = buildExport({
    office,
    weights: enriched.weights,
    listings: routed.map((listing) => ({
      ...listing,
      scores: enriched.scores[listing.id] ?? null,
      nearbyReport: enriched.nearby[listing.id] ?? null,
    })),
    preferences: { maxBudget: null, maxCommuteMinutes: null, requiredFacilities: [] },
  });
  const result = await geminiAnalysis(JSON.stringify(data));
  if ("error" in result) return jsonError(result.error, 502);
  const scopeKey = parsed.data.ids.slice().sort().join(",");
  await prisma.aiTurn.create({
    data: { scopeKey, role: "assistant", content: JSON.stringify(result.analysis) },
  });
  return Response.json({ analysis: result.analysis });
}

export async function PUT(request: Request) {
  const body = z.object({ prompt: z.string().min(1).max(4000) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Pertanyaan kosong.");
  const result = await geminiText(body.data.prompt);
  if ("error" in result) return jsonError(result.error, 502);
  return Response.json(result);
}
