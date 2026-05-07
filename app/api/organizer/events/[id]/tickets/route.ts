import { NextRequest } from "next/server";
import { EventMode, Role, SeatInventoryStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { ticketTypeCreateSchema } from "@/src/lib/validators/event";

async function getOwnEvent(id: string, organizerProfileId: string) {
  return prisma.event.findFirst({
    where: { id, organizerProfileId },
    include: {
      seatingSections: {
        include: {
          _count: {
            select: {
              seats: { where: { status: { not: SeatInventoryStatus.BLOCKED } } },
            },
          },
        },
      },
      tableZones: true,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await getOwnEvent(id, profile.id);
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const tickets = await prisma.ticketType.findMany({
      where: { eventId: id },
      orderBy: { sortOrder: "asc" },
    });

    return ok(tickets);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await getOwnEvent(id, profile.id);
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (!["DRAFT", "REJECTED"].includes(event.status)) {
      return fail(400, { code: "NOT_EDITABLE", message: "Cannot add tickets to a non-draft event" });
    }

    const parsed = ticketTypeCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid ticket data", details: parsed.error.flatten() });
    }

    const { saleStartAt, saleEndAt, ...rest } = parsed.data;
    let quantity = rest.quantity;
    let price = rest.price;

    if (event.mode === EventMode.RESERVED_SEATING && rest.sectionId) {
      const section = event.seatingSections.find((item) => item.id === rest.sectionId);
      const tableZone = event.tableZones.find((item) => item.id === rest.sectionId);

      if (!section && !tableZone) {
        return fail(400, {
          code: "INVALID_SECTION",
          message: "Select a seating section or table zone from this event",
        });
      }

      if (section) {
        if (section._count.seats < 1) {
          return fail(400, {
            code: "SECTION_HAS_NO_SEATS",
            message: "Generate seats in this section before creating a section ticket",
          });
        }
        quantity = section._count.seats;
        if (section.price !== null) price = Number(section.price);
      }

      if (tableZone) {
        quantity = tableZone.totalTables;
        price = Number(tableZone.price);
      }
    }
    const sortOrder = parsed.data.sortOrder !== 0
      ? parsed.data.sortOrder
      : ((await prisma.ticketType.aggregate({
          where: { eventId: id },
          _max: { sortOrder: true },
        }))._max.sortOrder ?? -1) + 1;

    const ticket = await prisma.ticketType.create({
      data: {
        ...rest,
        eventId: id,
        price,
        quantity,
        sortOrder,
        ...(saleStartAt ? { saleStartAt: new Date(saleStartAt) } : {}),
        ...(saleEndAt ? { saleEndAt: new Date(saleEndAt) } : {}),
      },
    });

    return ok(ticket, 201);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create ticket type" });
  }
}
