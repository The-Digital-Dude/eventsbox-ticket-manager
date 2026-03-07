import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      include: { ticketTypes: true },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (!["DRAFT", "REJECTED"].includes(event.status)) {
      return fail(400, { code: "INVALID_STATUS", message: "Only DRAFT or REJECTED events can be submitted" });
    }

    if (event.ticketTypes.filter((t) => t.isActive).length === 0) {
      return fail(400, { code: "NO_TICKETS", message: "Add at least one active ticket type before submitting" });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { status: "PENDING_APPROVAL", submittedAt: new Date(), rejectionReason: null },
    });

    return ok(updated);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to submit event" });
  }
}
