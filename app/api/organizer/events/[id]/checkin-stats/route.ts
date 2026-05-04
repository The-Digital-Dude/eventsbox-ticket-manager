import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

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
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      select: { id: true },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const [totalTickets, checkedIn, invalidScansToday] = await Promise.all([
      prisma.qRTicket.count({
        where: {
          order: {
            eventId: id,
            status: "PAID",
          },
        },
      }),
      prisma.qRTicket.count({
        where: {
          order: {
            eventId: id,
            status: "PAID",
          },
          OR: [{ isCheckedIn: true }, { checkedInAt: { not: null } }],
        },
      }),
      prisma.auditLog.count({
        where: {
          action: { in: ["SCANNER_INVALID_SCAN", "SCANNER_BATCH_INVALID_SCAN"] },
          entityType: "Event",
          entityId: id,
          createdAt: { gte: startOfToday() },
        },
      }),
    ]);

    return ok({
      totalTickets,
      checkedIn,
      remaining: Math.max(totalTickets - checkedIn, 0),
      invalidScansToday,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Organizer only" });
    if (authResponse) return authResponse;
    console.error("[api/organizer/events/[id]/checkin-stats] failed", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load check-in stats" });
  }
}
