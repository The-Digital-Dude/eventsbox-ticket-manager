import { NextRequest } from "next/server";
import { EventStatus, Prisma, Role, TicketClassType } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { validateEvent } from "@/src/lib/event-engine";
import { publishableEventSchema } from "@/src/lib/validators/shared-event-schema";
import { getEventSeatingSectionSummaries } from "@/src/lib/services/event-seating-sections";
import { deriveEventLayoutDecision } from "@/src/lib/ticket-classes";
import { slugify } from "@/src/lib/utils/slug";
import type { EventDraft } from "@/src/types/event-draft";
import type { VenueSeatingConfig } from "@/src/types/venue-seating";

type LegacyTicketClass = {
  name?: string;
  price?: number;
  quantity?: number;
  classType?: string;
  type?: string;
};

const ticketClassTypeMap = {
  general: TicketClassType.GENERAL_ADMISSION,
  assigned_seat: TicketClassType.ASSIGNED_SEAT,
  table: TicketClassType.TABLE,
} as const;

type CreatedSection = {
  id: string;
  key: string;
  sectionType: "ROWS" | "TABLES" | "SECTIONED_GA";
  capacity: number | null;
};

function getGeneratedSectionKey(ticketClass: { id: string; type: string }) {
  if (ticketClass.type === "table") return `generated-${ticketClass.id}-tables`;
  if (ticketClass.type === "assigned_seat") return `generated-${ticketClass.id}-seats`;
  return null;
}

function isCompatibleCreatedSection(ticketClassType: string, section: CreatedSection) {
  if (ticketClassType === "assigned_seat") return section.sectionType === "ROWS";
  if (ticketClassType === "table") return section.sectionType === "TABLES";
  return false;
}

function toDateInputParts(date: Date) {
  const iso = date.toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
  };
}

function normalizeLegacyTicketType(value?: string) {
  if (value === "TABLE" || value === "table") return "table";
  if (value === "ASSIGNED_SEAT" || value === "assigned_seat" || value === "seating") return "assigned_seat";
  return "general";
}

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

  const legacy = body as {
    title?: string;
    startAt?: string;
    venueName?: string;
    ticketClasses?: LegacyTicketClass[];
  };
  const start = legacy.startAt ? new Date(legacy.startAt) : new Date();
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const end = new Date(safeStart.getTime() + 2 * 60 * 60 * 1000);
  const startParts = toDateInputParts(safeStart);
  const endParts = toDateInputParts(end);

  return {
    details: {
      title: legacy.title ?? "Untitled Event",
      description: legacy.title ?? "Event details",
      category: "",
      tags: [],
      location: {
        type: "PHYSICAL",
        venueName: legacy.venueName ?? "Venue TBD",
        address: legacy.venueName ?? "Address TBD",
        city: "TBD",
        country: "TBD",
      },
      schedule: {
        startDate: startParts.date,
        startTime: startParts.time,
        endDate: endParts.date,
        endTime: endParts.time,
        startsAt: safeStart.toISOString(),
        endsAt: end.toISOString(),
        timezone: "UTC",
        isRecurring: false,
      },
      organizer: {},
      media: { gallery: [] },
      policies: { transferAllowed: true },
      visibility: { visibility: "PUBLIC", slug: slugify(legacy.title ?? "untitled-event") },
    },
    ticketClasses: (legacy.ticketClasses ?? []).map((ticketClass, index) => ({
      id: `legacy-${index}`,
      name: ticketClass.name ?? "General Admission",
      price: ticketClass.price ?? 0,
      quantity: ticketClass.quantity ?? 1,
      type: normalizeLegacyTicketType(ticketClass.type ?? ticketClass.classType),
    })),
  };
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
    if (profile.approvalStatus !== "APPROVED") {
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
      seatingLayout: (layout ?? {}) as EventDraft["seatingLayout"],
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
    const seatingConfig = layout?.seatingConfig as VenueSeatingConfig | undefined;
    const layoutDecision = deriveEventLayoutDecision(
      ticketClasses.map((ticketClass) => (ticketClass.type === "assigned_seat" ? "seating" : ticketClass.type)),
    );
    const seatingPlanCreate = seatingConfig && layout
      ? {
          create: {
            mode: layoutDecision.eventSeatingMode,
            seatingConfig: seatingConfig as Prisma.InputJsonValue,
            seatState: (layout.seatState ?? {}) as Prisma.InputJsonValue,
            summary: (layout.summary ?? {}) as Prisma.InputJsonValue,
            sections: {
              create: getEventSeatingSectionSummaries(seatingConfig).map((section) => ({
                key: section.key,
                name: section.name,
                sectionType: section.sectionType,
                capacity: section.capacity,
                sortOrder: section.sortOrder,
              })),
            },
          },
        }
      : undefined;
    const category = details.category
      ? await prisma.category.findUnique({ where: { id: details.category }, select: { id: true } })
      : null;

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          title: details.title,
          description: details.description,
          slug: await getUniqueEventSlug(details.visibility.slug ?? details.title),
          eventLocationType: details.location.type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          location: details.location as any,
          organizerProfileId: profile.id,
          venueId: venueId || undefined,
          status: EventStatus.PENDING_APPROVAL,
          submittedAt: new Date(),
          categoryId: category?.id ?? null,
          heroImage: details.media.coverImage ?? null,
          images: details.media.gallery,
          videoUrl: details.media.promoVideoUrl ?? null,
          contactEmail: details.organizer.organizerEmail ?? null,
          contactPhone: details.organizer.organizerPhone ?? null,
          cancelPolicy: details.policies.cancellationPolicy ?? null,
          refundPolicy: details.policies.refundPolicy ?? null,
          tags: details.tags,
          startAt: schedule.startsAt,
          endAt: schedule.endsAt,
          timezone: schedule.timezone,
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
          seatingPlan: seatingPlanCreate,
        },
        include: {
          ticketTypes: {
            select: {
              id: true,
              quantity: true,
              sortOrder: true,
            },
          },
          seatingPlan: {
            include: {
              sections: {
                select: {
                  id: true,
                  key: true,
                  sectionType: true,
                  capacity: true,
                },
              },
            },
          },
        },
      });

      const sections = created.seatingPlan?.sections ?? [];
      if (sections.length > 0) {
        const mappedSectionIds = new Set<string>();
        for (const [index, ticketClass] of ticketClasses.entries()) {
          if (ticketClass.type === "general") continue;
          const ticketType = created.ticketTypes.find((ticket) => ticket.sortOrder === index);
          if (!ticketType) continue;

          const compatibleSections = sections.filter((section) => isCompatibleCreatedSection(ticketClass.type, section));
          const submittedMapping = mappings.find((mapping) => mapping.ticketClassId === ticketClass.id);
          const mappedSection = submittedMapping
            ? compatibleSections.find((section) =>
                section.id === submittedMapping.targetId ||
                section.key === submittedMapping.targetId,
              )
            : undefined;
          const generatedKey = getGeneratedSectionKey(ticketClass);
          const generatedSection = generatedKey
            ? compatibleSections.find((section) => section.key === generatedKey && !mappedSectionIds.has(section.id))
            : undefined;
          const targetSection =
            mappedSection ??
            generatedSection ??
            compatibleSections
              .filter((section) => !mappedSectionIds.has(section.id))
              .sort((a, b) => (a.capacity ?? Number.MAX_SAFE_INTEGER) - (b.capacity ?? Number.MAX_SAFE_INTEGER))
              .find((section) => section.capacity === null || section.capacity >= ticketType.quantity) ??
            compatibleSections.find((section) => !mappedSectionIds.has(section.id));

          if (!targetSection) continue;
          mappedSectionIds.add(targetSection.id);
          await tx.ticketType.update({
            where: { id: ticketType.id },
            data: { eventSeatingSectionId: targetSection.id },
          });
        }
      }

      return tx.event.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          startAt: true,
          endAt: true,
          timezone: true,
          category: { select: { id: true, name: true } },
        },
      });
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
