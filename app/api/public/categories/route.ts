import { prisma } from "@/src/lib/db";
import { ok } from "@/src/lib/http/response";

export async function GET() {
  const rows = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return ok(rows);
}
