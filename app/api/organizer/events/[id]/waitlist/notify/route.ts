import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { notifyWaitlist } from "@/src/lib/services/waitlist";

const waitlistNotifySchema = z.object({
  ticketTypeId: z.string().cuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const parsed = waitlistNotifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid notify payload",
        details: parsed.error.flatten(),
      });
    }

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      select: { id: true },
    });
    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const ticketType = await prisma.ticketType.findFirst({
      where: { id: parsed.data.ticketTypeId, eventId: event.id },
      select: { id: true },
    });
    if (!ticketType) {
      return fail(404, { code: "TICKET_NOT_FOUND", message: "Ticket type not found for event" });
    }

    const unnotifiedCount = await prisma.waitlist.count({
      where: {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        notifiedAt: null,
      },
    });

    if (unnotifiedCount === 0) {
      return ok({ notified: 0 });
    }

    await notifyWaitlist(ticketType.id, unnotifiedCount);

    return ok({ notified: unnotifiedCount });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/events/[id]/waitlist/notify/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to notify waitlist" });
  }
}
