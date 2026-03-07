import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
  const categoryId = req.nextUrl.searchParams.get("categoryId") || undefined;
  const stateId = req.nextUrl.searchParams.get("stateId") || undefined;

  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      ...(categoryId ? { categoryId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      venue: { select: { id: true, name: true } },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: { id: true, name: true, price: true, quantity: true, sold: true },
      },
      organizerProfile: { select: { companyName: true, brandName: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return ok(events);
}
