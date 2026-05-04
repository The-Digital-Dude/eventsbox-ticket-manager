import { NextRequest } from "next/server";
import { EventMode, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { seatingDeleteSchema, seatingPatchSchema } from "@/src/lib/validators/event";

async function getOwnedReservedEvent(eventId: string, userId: string) {
  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) return { error: fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" }) };

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerProfileId: profile.id },
    select: { id: true, mode: true },
  });
  if (!event) return { error: fail(404, { code: "NOT_FOUND", message: "Event not found" }) };
  if (event.mode !== EventMode.RESERVED_SEATING) {
    return { error: fail(400, { code: "INVALID_EVENT_MODE", message: "Seating builder is only available for reserved seating events" }) };
  }

  return { event };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, zoneId } = await params;
    const owned = await getOwnedReservedEvent(id, auth.sub);
    if ("error" in owned) return owned.error;

    const parsed = seatingPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid seating update", details: parsed.error.flatten() });
    }

    if (parsed.data.type === "SECTION") {
      const existing = await prisma.seatingSection.findFirst({ where: { id: zoneId, eventId: id }, select: { id: true } });
      if (!existing) return fail(404, { code: "SECTION_NOT_FOUND", message: "Section not found" });
      return ok(await prisma.seatingSection.update({
        where: { id: zoneId },
        data: {
          name: parsed.data.name,
          color: parsed.data.color,
          sortOrder: parsed.data.sortOrder,
        },
      }));
    }

    if (parsed.data.type === "ROW") {
      const existing = await prisma.seatingRow.findFirst({
        where: { id: zoneId, section: { eventId: id } },
        select: { id: true },
      });
      if (!existing) return fail(404, { code: "ROW_NOT_FOUND", message: "Row not found" });
      return ok(await prisma.seatingRow.update({
        where: { id: zoneId },
        data: {
          label: parsed.data.label,
          sortOrder: parsed.data.sortOrder,
        },
      }));
    }

    if (parsed.data.type === "TABLE_ZONE") {
      const existing = await prisma.tableZone.findFirst({ where: { id: zoneId, eventId: id }, select: { id: true } });
      if (!existing) return fail(404, { code: "TABLE_ZONE_NOT_FOUND", message: "Table zone not found" });
      return ok(await prisma.tableZone.update({
        where: { id: zoneId },
        data: {
          name: parsed.data.name,
          seatsPerTable: parsed.data.seatsPerTable,
          totalTables: parsed.data.totalTables,
          price: parsed.data.price,
          color: parsed.data.color,
        },
      }));
    }

    const seat = await prisma.seatInventory.findFirst({ where: { id: zoneId, eventId: id }, select: { id: true } });
    if (!seat) return fail(404, { code: "SEAT_NOT_FOUND", message: "Seat not found" });
    return ok(await prisma.seatInventory.update({ where: { id: zoneId }, data: { status: parsed.data.status } }));
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/seating/[zoneId]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update seating item" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, zoneId } = await params;
    const owned = await getOwnedReservedEvent(id, auth.sub);
    if ("error" in owned) return owned.error;

    const type = req.nextUrl.searchParams.get("type");
    const parsed = seatingDeleteSchema.safeParse({ type });
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Delete type is required", details: parsed.error.flatten() });
    }

    if (parsed.data.type === "SECTION") {
      const existing = await prisma.seatingSection.findFirst({ where: { id: zoneId, eventId: id }, select: { id: true } });
      if (!existing) return fail(404, { code: "SECTION_NOT_FOUND", message: "Section not found" });
      await prisma.seatingSection.delete({ where: { id: zoneId } });
      return ok({ deleted: true });
    }

    if (parsed.data.type === "ROW") {
      const existing = await prisma.seatingRow.findFirst({
        where: { id: zoneId, section: { eventId: id } },
        select: { id: true },
      });
      if (!existing) return fail(404, { code: "ROW_NOT_FOUND", message: "Row not found" });
      await prisma.seatingRow.delete({ where: { id: zoneId } });
      return ok({ deleted: true });
    }

    if (parsed.data.type === "TABLE_ZONE") {
      const existing = await prisma.tableZone.findFirst({ where: { id: zoneId, eventId: id }, select: { id: true } });
      if (!existing) return fail(404, { code: "TABLE_ZONE_NOT_FOUND", message: "Table zone not found" });
      await prisma.tableZone.delete({ where: { id: zoneId } });
      return ok({ deleted: true });
    }

    const seat = await prisma.seatInventory.findFirst({ where: { id: zoneId, eventId: id }, select: { id: true } });
    if (!seat) return fail(404, { code: "SEAT_NOT_FOUND", message: "Seat not found" });
    await prisma.seatInventory.delete({ where: { id: zoneId } });
    return ok({ deleted: true });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/seating/[zoneId]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to delete seating item" });
  }
}
