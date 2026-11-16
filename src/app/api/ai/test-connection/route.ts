import { geminiText } from "@/server/ai/gemini";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await geminiText("Balas hanya dengan kata: tersambung");
  if ("error" in result) return jsonError(result.error, 502);
  return Response.json({ ok: true, sample: result.text.slice(0, 80) });
}
