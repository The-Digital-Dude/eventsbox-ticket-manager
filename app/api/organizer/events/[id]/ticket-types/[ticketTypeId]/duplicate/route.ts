import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketTypeId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, ticketTypeId } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({ where: { id, organizerProfileId: profile.id } });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    if (!["DRAFT", "REJECTED"].includes(event.status)) {
      return fail(400, { code: "NOT_EDITABLE", message: "Cannot duplicate tickets for a non-draft event" });
    }

    const source = await prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId: id } });
    if (!source) return fail(404, { code: "NOT_FOUND", message: "Ticket type not found" });

    const ticket = await prisma.ticketType.create({
      data: {
        eventId: id,
        sectionId: source.sectionId,
        name: `${source.name} (Copy)`,
        description: source.description,
        kind: source.kind,
        price: source.price,
        quantity: source.quantity,
        manualSoldOutPreviousQuantity: null,
        sold: 0,
        manuallySoldOut: false,
        reservedQty: 0,
        compIssued: 0,
        saleStartAt: source.saleStartAt,
        saleEndAt: source.saleEndAt,
        maxPerOrder: source.maxPerOrder,
        isActive: source.isActive,
        sortOrder: source.sortOrder + 1,
      },
    });

    return ok(ticket, 201);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/ticket-types/[ticketTypeId]/duplicate/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to duplicate ticket type" });
  }
}
