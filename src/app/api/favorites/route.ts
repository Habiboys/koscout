import { z } from "zod";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  listingId: z.string().min(1),
  status: z.enum(["saved", "contacted", "survey_scheduled", "surveyed", "chosen", "rejected"]).optional(),
  note: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const favorites = await prisma.favorite.findMany({
    include: { listing: true },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ favorites });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Favorit tidak valid.");
  const favorite = await prisma.favorite.upsert({
    where: { listingId: parsed.data.listingId },
    update: {
      status: parsed.data.status ?? "saved",
      note: parsed.data.note ?? undefined,
    },
    create: {
      listingId: parsed.data.listingId,
      status: parsed.data.status ?? "saved",
      note: parsed.data.note ?? null,
    },
  });
  return Response.json({ favorite });
}

export async function DELETE(request: Request) {
  const listingId = new URL(request.url).searchParams.get("listingId");
  if (!listingId) return jsonError("Kos tidak ditemukan.");
  await prisma.favorite.deleteMany({ where: { listingId } });
  return Response.json({ ok: true });
}
