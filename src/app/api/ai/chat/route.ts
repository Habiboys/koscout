import { z } from "zod";
import { geminiText } from "@/server/ai/gemini";
import { prisma } from "@/server/db";
import { buildExport } from "@/server/export/build-export";
import { enrichListings } from "@/server/enrich";
import { attachCommute, getActiveOffice, getListingsByIds } from "@/server/listings";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(10),
  question: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Pertanyaan tidak valid.");
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
  const scopeKey = parsed.data.ids.slice().sort().join(",");
  const history = await prisma.aiTurn.findMany({
    where: { scopeKey },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const prompt = [
    "Jawab pertanyaan pengguna hanya dari data JSON kos ini. Jangan mengarang.",
    "Nilai null berarti belum diketahui.",
    JSON.stringify(data),
    "Percakapan sebelumnya:",
    history.reverse().map((turn) => `${turn.role}: ${turn.content}`).join("\n"),
    `Pengguna: ${parsed.data.question}`,
  ].join("\n\n");
  const result = await geminiText(prompt);
  if ("error" in result) return jsonError(result.error, 502);
  await prisma.aiTurn.createMany({
    data: [
      { scopeKey, role: "user", content: parsed.data.question },
      { scopeKey, role: "assistant", content: result.text },
    ],
  });
  return Response.json({ answer: result.text });
}
