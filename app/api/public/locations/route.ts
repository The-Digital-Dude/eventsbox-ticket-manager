import { prisma } from "@/src/lib/db";
import { ok } from "@/src/lib/http/response";

export async function GET() {
  const rows = await prisma.state.findMany({ include: { cities: true }, orderBy: { name: "asc" } });
  return ok(rows);
}
