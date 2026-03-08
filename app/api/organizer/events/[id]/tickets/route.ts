import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { ticketTypeCreateSchema } from "@/src/lib/validators/event";

async function getOwnEvent(id: string, organizerProfileId: string) {
  return prisma.event.findFirst({ where: { id, organizerProfileId } });
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

    const ticket = await prisma.ticketType.create({
      data: {
        ...rest,
        eventId: id,
        price: rest.price,
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
