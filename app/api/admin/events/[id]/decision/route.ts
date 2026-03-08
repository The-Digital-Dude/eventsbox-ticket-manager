import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { eventDecisionSchema } from "@/src/lib/validators/event";
import { env } from "@/src/lib/env";
import { sendOrganizerEventStatusEmail } from "@/src/lib/services/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const parsed = eventDecisionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid decision payload", details: parsed.error.flatten() });
    }

    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        organizerProfile: { select: { user: { select: { email: true } } } },
      },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (event.status !== "PENDING_APPROVAL") {
      return fail(400, { code: "INVALID_STATUS", message: "Only PENDING_APPROVAL events can be actioned" });
    }

    const { action, reason } = parsed.data;

    const updated = await prisma.event.update({
      where: { id },
      data: {
        status: action,
        ...(action === "PUBLISHED" ? { publishedAt: new Date(), rejectionReason: null } : {}),
        ...(action === "REJECTED" ? { rejectionReason: reason ?? "Rejected by admin" } : {}),
      },
    });

    await sendOrganizerEventStatusEmail({
      to: event.organizerProfile.user.email,
      eventTitle: event.title,
      status: action,
      reason: action === "REJECTED" ? reason ?? "Rejected by admin" : undefined,
      eventUrl: `${env.APP_URL}/organizer/events/${id}`,
    });

    return ok(updated);
  } catch (error) {
    console.error("[app/api/admin/events/[id]/decision/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to process decision" });
  }
}
