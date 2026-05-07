import { NextRequest } from "next/server";
import { EventMode, Role, SeatInventoryStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

async function getOwnedEvent(eventId: string, userId: string) {
  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) return { error: fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" }) };

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerProfileId: profile.id },
    select: { id: true, mode: true },
  });
  if (!event) return { error: fail(404, { code: "NOT_FOUND", message: "Event not found" }) };
  if (event.mode !== EventMode.RESERVED_SEATING) {
    return { error: fail(400, { code: "INVALID_EVENT_MODE", message: "Ticket sync is only available for reserved seating events" }) };
  }

  return { event };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const owned = await getOwnedEvent(id, auth.sub);
    if ("error" in owned) return owned.error;

    const [seatingSections, tableZones] = await Promise.all([
      prisma.seatingSection.findMany({
        where: { eventId: id, price: { not: null }, seats: { some: { status: { not: SeatInventoryStatus.BLOCKED } } } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          _count: {
            select: {
              seats: { where: { status: { not: SeatInventoryStatus.BLOCKED } } },
            },
          },
        },
      }),
      prisma.tableZone.findMany({
        where: { eventId: id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const synced = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const section of seatingSections) {
        const existing = await tx.ticketType.findFirst({
          where: { eventId: id, sectionId: section.id },
          orderBy: { createdAt: "asc" },
        });

        const data = {
          name: section.name,
          price: section.price ?? 0,
          quantity: section._count.seats,
          sectionId: section.id,
          isActive: true,
        };

        const ticketType = existing
          ? await tx.ticketType.update({ where: { id: existing.id }, data })
          : await tx.ticketType.create({ data: { ...data, eventId: id } });

        results.push({
          action: existing ? "updated" : "created",
          sourceType: "SECTION",
          sourceId: section.id,
          ticketType,
        });
      }

      for (const zone of tableZones) {
        const existing = await tx.ticketType.findFirst({
          where: { eventId: id, sectionId: zone.id },
          orderBy: { createdAt: "asc" },
        });

        const data = {
          name: zone.name,
          price: zone.price,
          quantity: zone.totalTables,
          sectionId: zone.id,
          isActive: true,
        };

        const ticketType = existing
          ? await tx.ticketType.update({ where: { id: existing.id }, data })
          : await tx.ticketType.create({ data: { ...data, eventId: id } });

        results.push({
          action: existing ? "updated" : "created",
          sourceType: "TABLE",
          sourceId: zone.id,
          ticketType,
        });
      }

      return results;
    });

    return ok({ ticketTypes: synced });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/sync/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to sync ticket types" });
  }
}
