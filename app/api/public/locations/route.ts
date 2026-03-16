import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryId = searchParams.get("countryId");

  const [countries, states] = await Promise.all([
    prisma.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.state.findMany({
      where: countryId ? { countryId } : undefined,
      include: { cities: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return ok({ countries, states });
}
