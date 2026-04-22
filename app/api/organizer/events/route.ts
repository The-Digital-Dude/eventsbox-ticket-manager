import { NextRequest } from "next/server";
import { EventStatus, Prisma, Role, TicketClassType } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { validateEvent } from "@/src/lib/event-engine";
import { publishableEventSchema } from "@/src/lib/validators/shared-event-schema";

import { deriveEventLayoutDecision } from "@/src/lib/ticket-classes";
import { slugify } from "@/src/lib/utils/slug";
import type { EventDraft } from "@/src/types/event-draft";
import {
  getEventApprovalDecision,
  getPlatformFinancialDefaults,
  shouldAutoApproveOrganizer,
} from "@/src/lib/services/platform-settings";

const ticketClassTypeMap = {
  general: TicketClassType.GENERAL_ADMISSION,
  assigned_seat: TicketClassType.ASSIGNED_SEAT,
  table: TicketClassType.TABLE,
} as const;

function normalizeCreatePayload(body: unknown) {
  if (!body || typeof body !== "object") return body;
  if ("details" in body) {
    const draft = body as Record<string, unknown>;
    return {
      ...draft,
      layout: draft.layout ?? draft.seatingLayout,
      mappings: draft.mappings ?? draft.ticketMappings ?? [],
    };
  }

  // Legacy payload support removed
  return body;
}

async function getUniqueEventSlug(title: string) {
  const base = slugify(title) || "event";
  let candidate = base;
  let suffix = 2;

  while (await prisma.event.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile not found" });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const events = await prisma.event.findMany({
      where: {
        organizerProfileId: profile.id,
        ...(status ? { status: status as Prisma.EnumEventStatusFilter<"Event"> } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        startAt: true,
        endAt: true,
        rejectionReason: true,
        category: { select: { name: true } },
        venue: { select: { name: true } },
        _count: { select: { ticketTypes: true, orders: true } },
      },
    });

    return ok(events);
  } catch (error) {
    console.error("[GET /api/organizer/events]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to load events" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile not found" });
    const approvalDecision = await getEventApprovalDecision();
    const financialDefaults = await getPlatformFinancialDefaults();
    const organizerApprovalDisabled = await shouldAutoApproveOrganizer();
    const organizerMayCreate =
      profile.approvalStatus === "APPROVED" ||
      organizerApprovalDisabled;
    if (!organizerMayCreate) {
      return fail(403, { code: "NOT_APPROVED", message: "Your account must be approved before creating events" });
    }

    const parsed = publishableEventSchema.safeParse(normalizeCreatePayload(await req.json()));
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid event data", details: parsed.error.flatten() });
    }

    const { venueId, details, ticketClasses, layout, mappings } = parsed.data;
    const validationDraft: EventDraft = {
      venueId,
      details,
      ticketClasses,
      seatingLayout: layout,
      ticketMappings: mappings,
      meta: {
        lastCompletedStep: 5,
        version: 0,
        lastSaved: new Date().toISOString(),
        isPublished: false,
      },
    };
    const validationIssues = validateEvent(validationDraft);
    if (validationIssues.length > 0) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Event draft is not ready for approval",
        details: validationIssues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    const { schedule } = details;
    const layoutDecision = deriveEventLayoutDecision(
      ticketClasses.map((ticketClass) => (ticketClass.type === "assigned_seat" ? "seating" : ticketClass.type)),
    );
    const shouldPublish = !approvalDecision.approvalRequired;
    const category = details.category
      ? await prisma.category.findUnique({ where: { id: details.category }, select: { id: true } })
      : null;

    const event = await prisma.event.create({
      data: {
        title: details.title,
        description: details.description,
        slug: await getUniqueEventSlug(details.visibility.slug ?? details.title),
        eventLocationType: details.location.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: details.location as any,
        organizerProfileId: profile.id,
        venueId: venueId || undefined,
        status: shouldPublish ? EventStatus.PUBLISHED : EventStatus.PENDING_APPROVAL,
        submittedAt: new Date(),
        publishedAt: shouldPublish ? new Date() : null,
        categoryId: category?.id ?? null,
        heroImage: details.media.coverImage ?? null,
        images: details.media.gallery,
        videoUrl: details.media.promoVideoUrl ?? null,
        contactEmail: details.organizer.organizerEmail ?? null,
        contactPhone: details.organizer.organizerPhone ?? null,
        cancelPolicy: details.policies.cancellationPolicy ?? financialDefaults.defaultCancellationPolicy ?? null,
        refundPolicy: details.policies.refundPolicy ?? null,
        tags: details.tags,
        startAt: schedule.startsAt,
        endAt: schedule.endsAt,
        timezone: schedule.timezone,
        currency: financialDefaults.currency,
        commissionPct: financialDefaults.commissionPct,
        gstPct: financialDefaults.gstPct,
        platformFeeFixed: financialDefaults.platformFeeFixed,
        seatingMode: layoutDecision.eventSeatingMode,
        ticketTypes: {
          create: ticketClasses.map((tc, index) => ({
            name: tc.name,
            price: tc.price,
            quantity: tc.quantity,
            classType: ticketClassTypeMap[tc.type],
            sortOrder: index,
          })),
        },
      },
    });

    return ok(event, 201);
  } catch (error) {
    console.error("[app/api/organizer/events/route.ts]", error);
    return fail(500, {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Failed to create event",
    });
  }
}
