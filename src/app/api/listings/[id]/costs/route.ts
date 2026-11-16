import { z } from "zod";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  roomSizeM2: z.number().positive().max(500).nullable().optional(),
  depositAmount: z.number().int().nonnegative().nullable().optional(),
  adminFee: z.number().int().nonnegative().nullable().optional(),
  movingFee: z.number().int().nonnegative().nullable().optional(),
  electricityStatus: z.enum(["included", "excluded", "unknown"]),
  electricityMonthly: z.number().int().nonnegative().nullable().optional(),
  internetStatus: z.enum(["included", "excluded", "unknown"]),
  internetMonthly: z.number().int().nonnegative().nullable().optional(),
  laundryMonthly: z.number().int().nonnegative().nullable().optional(),
  otherMonthly: z.number().int().nonnegative().nullable().optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Biaya tidak valid.");
  const listing = await prisma.listing.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!listing) return jsonError("Kos tidak ditemukan.", 404);
  return Response.json({ ok: true });
}
