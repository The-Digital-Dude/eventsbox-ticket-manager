import { NextRequest } from "next/server";
import { EventSeatingMode, EventStatus, Prisma, Role, TicketClassType } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { publishableEventSchema } from "@/src/lib/validators/shared-event-schema";
import { slugify } from "@/src/lib/utils/slug";

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
  if ("details" in body) return body;

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

    const { details, ticketClasses, layout } = parsed.data;
    const { schedule } = details;
    const seatingConfig = layout?.seatingConfig;
    const seatingPlanCreate = seatingConfig && layout
      ? {
          create: {
            mode: EventSeatingMode.GA_ONLY, // This needs to be derived properly
            seatingConfig: seatingConfig as Prisma.InputJsonValue,
            seatState: (layout.seatState ?? {}) as Prisma.InputJsonValue,
            summary: (layout.summary ?? {}) as Prisma.InputJsonValue,
          },
        }
      : undefined;
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
        ticketTypes: {
          create: ticketClasses.map((tc) => ({
            name: tc.name,
            price: tc.price,
            quantity: tc.quantity,
            classType: ticketClassTypeMap[tc.type],
          })),
        },
        seatingPlan: seatingPlanCreate,
      },
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

    return ok(event, 201);
  } catch (error) {
    console.error("[app/api/organizer/events/route.ts]", error);
    return fail(500, {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Failed to create event",
    });
  }
}
