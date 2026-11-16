import { appendFile } from "node:fs/promises";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import { DEFAULT_WEIGHTS, normalizeWeights, type Weights } from "@/server/scoring/weights";

const keyFile = path.join(process.cwd(), "data", "gemini-key.json");

export async function ensureAppSecret(): Promise<string> {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const secret = randomBytes(32).toString("hex");
  process.env.APP_SECRET = secret;
  await appendFile(path.join(process.cwd(), ".env"), `\nAPP_SECRET="${secret}"\n`, "utf8");
  return secret;
}

export async function saveGeminiKey(apiKey: string): Promise<void> {
  const secret = await ensureAppSecret();
  const key = scryptSync(secret, "kosfinder-gemini", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  await mkdir(path.dirname(keyFile), { recursive: true });
  await writeFile(
    keyFile,
    JSON.stringify({
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    }),
    "utf8",
  );
}

export async function readGeminiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const secret = process.env.APP_SECRET;
    if (!secret) return null;
    const raw = JSON.parse(await readFile(keyFile, "utf8")) as { iv: string; tag: string; data: string };
    const key = scryptSync(secret, "kosfinder-gemini", 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(raw.iv, "base64"));
    decipher.setAuthTag(Buffer.from(raw.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(raw.data, "base64")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

export async function geminiConfigured(): Promise<boolean> {
  return Boolean(await readGeminiKey());
}

export async function getWeights(): Promise<Weights> {
  const row = await prisma.setting.findUnique({ where: { key: "weights" } });
  if (!row) return DEFAULT_WEIGHTS;
  try {
    return normalizeWeights(JSON.parse(row.value) as Partial<Weights>);
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export async function saveWeights(weights: Weights): Promise<void> {
  const value = JSON.stringify(normalizeWeights(weights));
  await prisma.setting.upsert({
    where: { key: "weights" },
    update: { value },
    create: { key: "weights", value },
  });
}

export async function getAiPreferences(): Promise<{ model: string; language: string; detail: string; enabled: boolean }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["ai-model", "ai-language", "ai-detail", "ai-enabled"] } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    model: map.get("ai-model") ?? "gemini-2.5-flash",
    language: map.get("ai-language") ?? "id",
    detail: map.get("ai-detail") ?? "singkat",
    enabled: map.get("ai-enabled") !== "false",
  };
}

export async function saveAiPreferences(input: {
  model: string;
  language: string;
  detail: string;
  enabled: boolean;
}): Promise<void> {
  const entries = [
    ["ai-model", input.model],
    ["ai-language", input.language],
    ["ai-detail", input.detail],
    ["ai-enabled", input.enabled ? "true" : "false"],
  ] as const;
  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}
