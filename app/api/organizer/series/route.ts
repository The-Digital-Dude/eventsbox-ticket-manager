import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { eventSeriesSchema } from "@/src/lib/validators/event";

const seriesInclude = {
  _count: { select: { events: true } },
};

async function getOrganizerProfileId(userId: string) {
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  return profile?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const organizerProfileId = await getOrganizerProfileId(auth.sub);
    if (!organizerProfileId) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const series = await prisma.eventSeries.findMany({
      where: { organizerProfileId },
      include: seriesInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return ok(series);
  } catch (error) {
    console.error("[app/api/organizer/series/route.ts][GET]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const organizerProfileId = await getOrganizerProfileId(auth.sub);
    if (!organizerProfileId) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const parsed = eventSeriesSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid event series payload",
        details: parsed.error.flatten(),
      });
    }

    const series = await prisma.eventSeries.create({
      data: {
        organizerProfileId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        recurrenceType: parsed.data.recurrenceType || null,
        recurrenceDaysOfWeek: parsed.data.recurrenceDaysOfWeek || [],
        recurrenceEndDate: parsed.data.recurrenceEndDate ? new Date(parsed.data.recurrenceEndDate) : null,
      },
      include: seriesInclude,
    });

    return ok(series, 201);
  } catch (error) {
    console.error("[app/api/organizer/series/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create event series" });
  }
}
