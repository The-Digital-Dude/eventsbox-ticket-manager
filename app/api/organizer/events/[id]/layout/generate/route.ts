import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireRole } from "@/src/lib/auth/guards";
import { Role, EventSeatingMode, EventSeatingSectionType } from "@prisma/client";
import { z } from "zod";

const generateLayoutRequestSchema = z.object({
  ticketClasses: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    type: z.enum(["general", "assigned_seat", "table"]),
  })),
});

function makeSectionKey(ticketClassId: string, suffix: string) {
  return `generated-${ticketClassId}-${suffix}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id: eventId } = params;

    const parsed = generateLayoutRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid request payload", details: parsed.error.flatten() });
    }

    const { ticketClasses } = parsed.data;

    const sectionsToCreate: { key: string, name: string, sectionType: EventSeatingSectionType, capacity: number }[] = [];

    for (const ticketClass of ticketClasses) {
      if (ticketClass.quantity <= 0) continue;

      if (ticketClass.type === "table") {
        sectionsToCreate.push({
          key: makeSectionKey(ticketClass.id, "tables"),
          name: `${ticketClass.name} Tables`,
          sectionType: EventSeatingSectionType.TABLES,
          capacity: ticketClass.quantity,
        });
        continue;
      }

      if (ticketClass.type === "assigned_seat") {
        sectionsToCreate.push({
          key: makeSectionKey(ticketClass.id, "seats"),
          name: `${ticketClass.name} Seating`,
          sectionType: EventSeatingSectionType.ROWS,
          capacity: ticketClass.quantity,
        });
      }
    }

    if (sectionsToCreate.length === 0) {
      return ok(null);
    }

    const hasTables = sectionsToCreate.some((section) => section.sectionType === EventSeatingSectionType.TABLES);
    const hasSeats = sectionsToCreate.some((section) => section.sectionType === EventSeatingSectionType.ROWS);
    const mode: EventSeatingMode = hasTables && hasSeats ? EventSeatingMode.MIXED : hasTables ? EventSeatingMode.TABLES : EventSeatingMode.ROWS;

    const seatingPlan = await prisma.eventSeatingPlan.create({
      data: {
        eventId,
        mode,
        source: "CUSTOM",
        sections: {
          create: sectionsToCreate,
        },
      },
      include: {
        sections: true,
      }
    });

    return ok(seatingPlan);

  } catch (error) {
    console.error("[app/api/organizer/events/[id]/layout/generate/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to generate event layout" });
  }
}
