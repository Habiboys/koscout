import { z } from "zod";
import { readGeminiKey, getAiPreferences } from "@/server/settings";

const analysisSchema = z.object({
  bestOverall: z.string(),
  ranking: z.array(
    z.object({
      name: z.string(),
      reasons: z.array(z.string()),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    }),
  ),
  caveats: z.array(z.string()),
});

export type AiAnalysis = z.infer<typeof analysisSchema>;

const responseSchema = {
  type: "object",
  properties: {
    bestOverall: { type: "string" },
    ranking: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          reasons: { type: "array", items: { type: "string" } },
          pros: { type: "array", items: { type: "string" } },
          cons: { type: "array", items: { type: "string" } },
        },
        required: ["name", "reasons", "pros", "cons"],
      },
    },
    caveats: { type: "array", items: { type: "string" } },
  },
  required: ["bestOverall", "ranking", "caveats"],
};

export async function geminiText(prompt: string): Promise<{ text: string } | { error: string }> {
  const apiKey = await readGeminiKey();
  if (!apiKey) return { error: "Kunci Gemini belum diatur. Isi di Pengaturan atau lewat GEMINI_API_KEY." };
  const prefs = await getAiPreferences();
  if (!prefs.enabled) return { error: "Analisis Gemini dimatikan di pengaturan." };
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: prefs.model,
      contents: prompt,
    });
    const text = response.text?.trim();
    if (!text) return { error: "Gemini tidak mengembalikan teks." };
    return { text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini gagal dihubungi.";
    return { error: message };
  }
}

export async function geminiAnalysis(dataJson: string): Promise<{ analysis: AiAnalysis } | { error: string }> {
  const prefs = await getAiPreferences();
  const prompt = [
    "Analisis data kos berikut. Jangan mengarang angka atau fasilitas yang tidak ada di JSON.",
    "Nilai null berarti belum diketahui, bukan nol.",
    `Bahasa jawaban: ${prefs.language}. Detail: ${prefs.detail}.`,
    "Pilih satu kos terbaik dan jelaskan alasan, kelebihan, serta kekurangan dari data yang tersedia.",
    dataJson,
  ].join("\n\n");
  const apiKey = await readGeminiKey();
  if (!apiKey) return { error: "Kunci Gemini belum diatur." };
  if (!prefs.enabled) return { error: "Analisis Gemini dimatikan di pengaturan." };
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: prefs.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema,
      },
    });
    const parsed = analysisSchema.safeParse(JSON.parse(response.text ?? ""));
    if (!parsed.success) return { error: "Jawaban Gemini tidak sesuai format." };
    return { analysis: parsed.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini gagal dihubungi.";
    return { error: message };
  }
}
