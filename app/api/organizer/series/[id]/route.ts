import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { eventSeriesSchema } from "@/src/lib/validators/event";

const seriesInclude = {
  _count: { select: { events: true } },
};

async function getOwnSeries(seriesId: string, userId: string) {
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return { profileId: null, series: null };
  }

  const series = await prisma.eventSeries.findFirst({
    where: { id: seriesId, organizerProfileId: profile.id },
    include: seriesInclude,
  });

  return { profileId: profile.id, series };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const { series } = await getOwnSeries(id, auth.sub);
    if (!series) {
      return fail(404, { code: "NOT_FOUND", message: "Series not found" });
    }

    const parsed = eventSeriesSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid event series payload",
        details: parsed.error.flatten(),
      });
    }

    const updated = await prisma.eventSeries.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
      },
      include: seriesInclude,
    });

    return ok(updated);
  } catch (error) {
    console.error("[app/api/organizer/series/[id]/route.ts][PATCH]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update series" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const { series } = await getOwnSeries(id, auth.sub);
    if (!series) {
      return fail(404, { code: "NOT_FOUND", message: "Series not found" });
    }

    await prisma.$transaction([
      prisma.event.updateMany({
        where: { seriesId: id },
        data: { seriesId: null },
      }),
      prisma.eventSeries.delete({
        where: { id },
      }),
    ]);

    return ok({ deleted: true });
  } catch (error) {
    console.error("[app/api/organizer/series/[id]/route.ts][DELETE]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to delete series" });
  }
}
