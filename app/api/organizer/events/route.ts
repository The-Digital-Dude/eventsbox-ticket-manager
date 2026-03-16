import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { eventCreateSchema } from "@/src/lib/validators/event";
import { slugify } from "@/src/lib/utils/slug";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile not found" });

    const rawStatus = req.nextUrl.searchParams.get("status");
    const events = await prisma.event.findMany({
      where: {
        organizerProfileId: profile.id,
        ...(rawStatus ? { status: rawStatus as never } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        _count: { select: { ticketTypes: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(events);
  } catch (error) {
    console.error("[app/api/organizer/events/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
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

    const parsed = eventCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid event data", details: parsed.error.flatten() });
    }

    const { startAt, endAt, heroImage, videoUrl, contactEmail, ...rest } = parsed.data;

    if (new Date(endAt) <= new Date(startAt)) {
      return fail(400, { code: "INVALID_DATES", message: "End date must be after start date" });
    }

    const event = await prisma.event.create({
      data: {
        ...rest,
        heroImage: heroImage || null,
        videoUrl: videoUrl || null,
        contactEmail: contactEmail || null,
        organizerProfileId: profile.id,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        slug: slugify(parsed.data.title),
      },
      include: {
        category: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    return ok(event, 201);
  } catch (error) {
    console.error("[app/api/organizer/events/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create event" });
  }
}
