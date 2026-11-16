import { listRecords } from "@/server/listings";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ listings: await listRecords() });
}
