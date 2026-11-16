import { z } from "zod";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  checks: z.record(z.enum(["baik", "cukup", "buruk", "belum"])),
  note: z.string().max(2000).nullable().optional(),
  photoUrls: z.array(z.string().max(500)).max(8).optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Catatan survei tidak valid.");
  const data = {
    checks: JSON.stringify(parsed.data.checks),
    note: parsed.data.note ?? null,
    photoUrls: JSON.stringify(parsed.data.photoUrls ?? []),
  };
  const visit = await prisma.visitNote.upsert({
    where: { listingId: id },
    update: data,
    create: { listingId: id, ...data },
  });
  return Response.json({ visit });
}
