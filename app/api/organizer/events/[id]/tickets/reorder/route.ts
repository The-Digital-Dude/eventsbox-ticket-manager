import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

const reorderSchema = z.object({
  ticketIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      select: { id: true, status: true },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    if (!["DRAFT", "REJECTED"].includes(event.status)) {
      return fail(400, { code: "NOT_EDITABLE", message: "Cannot reorder tickets for a non-draft event" });
    }

    const parsed = reorderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid ticket order", details: parsed.error.flatten() });
    }

    const ticketIds = Array.from(new Set(parsed.data.ticketIds));
    if (ticketIds.length !== parsed.data.ticketIds.length) {
      return fail(400, { code: "DUPLICATE_TICKETS", message: "Ticket order cannot contain duplicates" });
    }

    const existing = await prisma.ticketType.findMany({
      where: { eventId: id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((ticket) => ticket.id));
    if (existing.length !== ticketIds.length || ticketIds.some((ticketId) => !existingIds.has(ticketId))) {
      return fail(400, { code: "INVALID_TICKET_ORDER", message: "Ticket order must include every ticket for this event" });
    }

    await prisma.$transaction(
      ticketIds.map((ticketId, index) =>
        prisma.ticketType.update({
          where: { id: ticketId },
          data: { sortOrder: index },
        }),
      ),
    );

    const tickets = await prisma.ticketType.findMany({
      where: { eventId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return ok(tickets);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/reorder/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to reorder tickets" });
  }
}
