import { z } from "zod";
import { geminiConfigured, getAiPreferences, getWeights, saveAiPreferences, saveGeminiKey, saveWeights } from "@/server/settings";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const [weights, ai, configured] = await Promise.all([getWeights(), getAiPreferences(), geminiConfigured()]);
  return Response.json({ weights, ai, geminiConfigured: configured });
}

const schema = z.object({
  weights: z.object({
    price: z.number().nonnegative(),
    commute: z.number().nonnegative(),
    facilities: z.number().nonnegative(),
    nearby: z.number().nonnegative(),
    transport: z.number().nonnegative(),
  }).optional(),
  ai: z.object({
    model: z.string().min(1).max(80),
    language: z.string().min(1).max(20),
    detail: z.enum(["singkat", "lengkap"]),
    enabled: z.boolean(),
  }).optional(),
  geminiKey: z.string().min(10).max(300).optional(),
});

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Pengaturan tidak valid.");
  if (parsed.data.weights) await saveWeights(parsed.data.weights);
  if (parsed.data.ai) await saveAiPreferences(parsed.data.ai);
  if (parsed.data.geminiKey) await saveGeminiKey(parsed.data.geminiKey);
  return Response.json({ ok: true, geminiConfigured: await geminiConfigured() });
}
