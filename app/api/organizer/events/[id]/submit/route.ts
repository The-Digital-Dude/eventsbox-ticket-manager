import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { deriveEventLayoutDecision, getTicketClassType } from "@/src/lib/ticket-classes";
import { getEventApprovalDecision } from "@/src/lib/services/platform-settings";

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPersistedVenueSatisfied(event: {
  venueId?: string | null;
  eventLocationType: string;
  location?: unknown;
}) {
  if (hasText(event.venueId)) return true;

  const location = event.location && typeof event.location === "object" ? event.location as Record<string, unknown> : null;

  if (event.eventLocationType === "PHYSICAL") {
    return (
      hasText(location?.venueName) &&
      hasText(location?.address) &&
      hasText(location?.city) &&
      hasText(location?.country)
    );
  }

  if (event.eventLocationType === "ONLINE") {
    return hasText(location?.accessLink);
  }

  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      include: {
        seatingPlan: {
          select: {
            id: true,
            sections: { select: { id: true } },
          },
        },
        ticketTypes: true,
      },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (!["DRAFT", "REJECTED"].includes(event.status)) {
      return fail(400, { code: "INVALID_STATUS", message: "Only DRAFT or REJECTED events can be submitted" });
    }

    if (event.ticketTypes.filter((t) => t.isActive).length === 0) {
      return fail(400, { code: "NO_TICKETS", message: "Add at least one active ticket type before submitting" });
    }

    if (!isPersistedVenueSatisfied(event)) {
      return fail(400, {
        code: "LOCATION_REQUIRED",
        message: "Add inline physical location details, online access details, or select a legacy venue before submitting",
      });
    }

    const activeTicketClassTypes = event.ticketTypes
      .filter((ticketType) => ticketType.isActive)
      .map((ticketType) => getTicketClassType(ticketType.classType));
    const layoutDecision = deriveEventLayoutDecision(activeTicketClassTypes);

    if (layoutDecision.requiresLayout && (event.seatingPlan?.sections.length ?? 0) === 0) {
      return fail(400, {
        code: "LAYOUT_REQUIRED",
        message: "Save the event layout before submitting this event",
      });
    }

    if (
      layoutDecision.requiresLayout &&
      event.ticketTypes.some((ticketType) =>
        ticketType.isActive &&
        getTicketClassType(ticketType.classType) !== "general" &&
        !ticketType.eventSeatingSectionId &&
        !ticketType.sectionId
      )
    ) {
      return fail(400, {
        code: "LAYOUT_MAPPING_REQUIRED",
        message: "Map every seating or table ticket class to a layout target before submitting",
      });
    }

    const approvalDecision = await getEventApprovalDecision();
    const shouldPublish = !approvalDecision.approvalRequired;

    const updated = await prisma.event.update({
      where: { id },
      data: {
        status: shouldPublish ? "PUBLISHED" : "PENDING_APPROVAL",
        submittedAt: new Date(),
        publishedAt: shouldPublish ? new Date() : null,
        rejectionReason: null,
      },
    });

    return ok(updated);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/submit/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to submit event" });
  }
}
