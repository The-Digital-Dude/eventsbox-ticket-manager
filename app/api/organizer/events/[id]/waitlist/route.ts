import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      select: {
        id: true,
        title: true,
        ticketTypes: {
          select: {
            id: true,
            name: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const entries = await prisma.waitlist.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        ticketTypeId: true,
        email: true,
        name: true,
        createdAt: true,
        notifiedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const byTicketType = event.ticketTypes
      .map((ticketType) => {
        const ticketEntries = entries
          .filter((entry) => entry.ticketTypeId === ticketType.id)
          .map((entry) => ({
            id: entry.id,
            email: entry.email,
            name: entry.name,
            joinedAt: entry.createdAt,
            notifiedAt: entry.notifiedAt,
          }));

        return {
          ticketTypeId: ticketType.id,
          ticketTypeName: ticketType.name,
          total: ticketEntries.length,
          notifiedCount: ticketEntries.filter((entry) => Boolean(entry.notifiedAt)).length,
          entries: ticketEntries,
        };
      })
      .filter((group) => group.total > 0);

    return ok({
      eventId: event.id,
      eventTitle: event.title,
      totalEntries: entries.length,
      byTicketType,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/events/[id]/waitlist/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load waitlist" });
  }
}
