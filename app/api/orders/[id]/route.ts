import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

export const dynamic = "force-dynamic";

// Public order lookup — used on confirmation page
// Secured by knowing the orderId (UUID-style) — no auth needed
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startAt: true,
          endAt: true,
          timezone: true,
          currency: true,
          venue: { select: { name: true, addressLine1: true } },
        },
      },
      orderAddOns: { include: { addOn: { select: { name: true } } } },
      items: {
        include: {
          ticketType: { select: { id: true, name: true, kind: true } },
          tickets: {
            select: { id: true, token: true, ticketNumber: true, seatLabel: true, checkedInAt: true },
          },
        },
      },
    },
  });

  if (!order) return fail(404, { code: "NOT_FOUND", message: "Order not found" });

  return ok(order);
}
