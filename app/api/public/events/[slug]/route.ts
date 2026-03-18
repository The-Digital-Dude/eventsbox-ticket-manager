import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { sanitizePublicSeatState } from "@/src/lib/venue-seating";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: { select: { id: true, name: true } },
      venue: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          lat: true,
          lng: true,
          seatingConfig: true,
          seatState: true,
        },
      },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      series: { select: { id: true, title: true } },
      addOns: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          maxPerOrder: true,
          totalStock: true,
        },
      },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          kind: true,
          sectionId: true,
          price: true,
          quantity: true,
          sold: true,
          reservedQty: true,
          maxPerOrder: true,
          saleStartAt: true,
          saleEndAt: true,
        },
      },
      organizerProfile: {
        select: {
          id: true,
          companyName: true,
          brandName: true,
          website: true,
          supportEmail: true,
        },
      },
    },
  });

  if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

  const addOnsWithStock = await Promise.all(
    (event.addOns || []).map(async (a) => {
      if (a.totalStock === null) return { ...a, remainingStock: null };
      const agg = await prisma.orderAddOn.aggregate({
        where: { addOnId: a.id, order: { status: "PAID" } },
        _sum: { quantity: true },
      });
      const sold = agg._sum.quantity || 0;
      return { ...a, remainingStock: Math.max(0, a.totalStock - sold) };
    })
  );

  return ok({
    ...event,
    addOns: addOnsWithStock,
    images: event.images ?? [],
    venue: event.venue
      ? {
          ...event.venue,
          seatingConfig: (event.venue.seatingConfig as VenueSeatingConfig | null) ?? null,
          seatState: sanitizePublicSeatState((event.venue.seatState as Record<string, SeatState> | null) ?? null),
        }
      : null,
  });
}
