import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const series = await prisma.eventSeries.findUnique({
    where: { id },
    include: {
      events: {
        where: { status: "PUBLISHED" },
        orderBy: { startAt: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          venue: { select: { id: true, name: true } },
          state: { select: { id: true, name: true } },
          city: { select: { id: true, name: true } },
          ticketTypes: {
            where: { isActive: true },
            orderBy: { price: "asc" },
            select: { id: true, name: true, price: true, quantity: true, sold: true, reservedQty: true },
          },
        },
      },
    },
  });

  if (!series) {
    return fail(404, { code: "NOT_FOUND", message: "Series not found" });
  }

  return ok(series);
}
