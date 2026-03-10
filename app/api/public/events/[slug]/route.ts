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
          seatingConfig: true,
          seatState: true,
        },
      },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      series: { select: { id: true, title: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          kind: true,
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

  return ok({
    ...event,
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
