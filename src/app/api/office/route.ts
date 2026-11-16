import { officeInputSchema } from "@/lib/validations";
import { activateOffice, createOffice, getActiveOffice, listOffices, saveOffice } from "@/server/listings";
import { jsonError } from "@/server/http";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ office: await getActiveOffice(), offices: await listOffices() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = officeInputSchema.safeParse(body);
  if (!parsed.success) return jsonError("Titik kantor belum valid.");
  const office = await createOffice(parsed.data);
  if (body && typeof body === "object" && "makeActive" in body && body.makeActive === true) {
    await activateOffice(office.id);
  }
  return Response.json({ office });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Kantor tidak ditemukan.");
  await prisma.office.delete({ where: { id } }).catch(() => null);
  const remaining = await listOffices();
  if (remaining.length > 0 && !remaining.some((office) => office.isActive)) {
    await activateOffice(remaining[0].id);
  }
  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const id = body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : "";
  if (!id) return jsonError("Kantor tidak ditemukan.");
  await activateOffice(id);
  return Response.json({ office: await getActiveOffice() });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = officeInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Titik kantor belum valid.");
  }
  const office = await saveOffice(parsed.data);
  return Response.json({ office });
}
