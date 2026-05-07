import { NextRequest } from "next/server";
import { EventMode, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { seatingPostSchema } from "@/src/lib/validators/event";

async function getOwnedReservedEvent(eventId: string, userId: string) {
  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) return { error: fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" }) };

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerProfileId: profile.id },
    select: { id: true, title: true, mode: true, organizerProfileId: true },
  });
  if (!event) return { error: fail(404, { code: "NOT_FOUND", message: "Event not found" }) };
  if (event.mode !== EventMode.RESERVED_SEATING) {
    return { error: fail(400, { code: "INVALID_EVENT_MODE", message: "Seating builder is only available for reserved seating events" }) };
  }

  return { event };
}

function rowLabel(index: number, prefix: string) {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${prefix}${label}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const owned = await getOwnedReservedEvent(id, auth.sub);
    if ("error" in owned) return owned.error;

    const [sections, tableZones] = await Promise.all([
      prisma.seatingSection.findMany({
        where: { eventId: id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          rows: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              seats: { orderBy: [{ seatLabel: "asc" }] },
            },
          },
          seats: true,
        },
      }),
      prisma.tableZone.findMany({
        where: { eventId: id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return ok({ event: owned.event, sections, tableZones });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/seating/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const owned = await getOwnedReservedEvent(id, auth.sub);
    if ("error" in owned) return owned.error;

    const parsed = seatingPostSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid seating payload", details: parsed.error.flatten() });
    }

    if (parsed.data.action === "createSection") {
      const section = await prisma.seatingSection.create({
        data: {
          eventId: id,
          name: parsed.data.name,
          price: parsed.data.price,
          color: parsed.data.color,
          sortOrder: parsed.data.sortOrder,
        },
      });
      return ok(section, 201);
    }

    if (parsed.data.action === "createRow") {
      const section = await prisma.seatingSection.findFirst({
        where: { id: parsed.data.sectionId, eventId: id },
        select: { id: true },
      });
      if (!section) return fail(404, { code: "SECTION_NOT_FOUND", message: "Section not found" });

      const row = await prisma.seatingRow.create({
        data: {
          sectionId: section.id,
          label: parsed.data.label,
          sortOrder: parsed.data.sortOrder,
        },
      });
      return ok(row, 201);
    }

    if (parsed.data.action === "createTableZone") {
      const tableZone = await prisma.tableZone.create({
        data: {
          eventId: id,
          name: parsed.data.name,
          seatsPerTable: parsed.data.seatsPerTable,
          totalTables: parsed.data.totalTables,
          price: parsed.data.price,
          color: parsed.data.color,
        },
      });
      return ok(tableZone, 201);
    }

    if (parsed.data.action !== "bulkSeats") {
      return fail(400, { code: "UNSUPPORTED_ACTION", message: "Unsupported seating action" });
    }

    const bulk = parsed.data;
    const section = await prisma.seatingSection.findFirst({
      where: { id: bulk.sectionId, eventId: id },
      include: { rows: { orderBy: { sortOrder: "asc" } } },
    });
    if (!section) return fail(404, { code: "SECTION_NOT_FOUND", message: "Section not found" });

    const created = await prisma.$transaction(async (tx) => {
      const targetRows = [];

      if (bulk.rowId) {
        const row = await tx.seatingRow.findFirst({
          where: { id: bulk.rowId, sectionId: section.id },
        });
        if (!row) throw new Error("ROW_NOT_FOUND");
        targetRows.push(row);
      } else {
        const baseSort = section.rows.length;
        for (let index = 0; index < bulk.rowCount; index += 1) {
          const label = rowLabel(baseSort + index, bulk.rowPrefix);
          const row = await tx.seatingRow.create({
            data: { sectionId: section.id, label, sortOrder: baseSort + index },
          });
          targetRows.push(row);
        }
      }

      const seats = targetRows.flatMap((row) =>
        Array.from({ length: bulk.seatsPerRow }, (_, index) => ({
          eventId: id,
          sectionId: section.id,
          rowId: row.id,
          seatLabel: `${row.label}-${index + 1}`,
        })),
      );

      await tx.seatInventory.createMany({ data: seats, skipDuplicates: true });
      return { rows: targetRows.length, seats: seats.length };
    });

    return ok(created, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "ROW_NOT_FOUND") {
      return fail(404, { code: "ROW_NOT_FOUND", message: "Row not found" });
    }
    console.error("[app/api/organizer/events/[id]/seating/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update seating map" });
  }
}
