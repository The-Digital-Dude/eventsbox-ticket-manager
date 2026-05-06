import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  const stateId = req.nextUrl.searchParams.get("stateId") || undefined;

  const [venues, cities] = await Promise.all([
    prisma.venue.findMany({
      where: { status: "APPROVED", isEventOnly: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    stateId
      ? prisma.city.findMany({
          where: { stateId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : prisma.city.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);

  return ok({ venues, cities });
}
