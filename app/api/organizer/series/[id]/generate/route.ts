import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { z } from "zod";
import { nanoid } from "nanoid";

const generateSchema = z.object({
  count: z.number().int().min(1).max(52),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Organizer not found" });

    const series = await prisma.eventSeries.findFirst({
      where: { id, organizerProfileId: profile.id },
    });
    if (!series) return fail(404, { code: "NOT_FOUND", message: "Series not found" });

    if (!series.recurrenceType) {
      return fail(400, { code: "NOT_RECURRING", message: "Series is not configured for recurrence" });
    }

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid count",
        details: parsed.error.flatten(),
      });
    }

    const { count } = parsed.data;

    const latestEvent = await prisma.event.findFirst({
      where: { seriesId: id },
      orderBy: { startAt: "desc" },
      include: {
        ticketTypes: true,
      },
    });

    if (!latestEvent) {
      return fail(400, { code: "NO_EVENTS", message: "No events in series to duplicate" });
    }

    let createdCount = 0;
    let currentStart = new Date(latestEvent.startAt);
    let currentEnd = new Date(latestEvent.endAt);

    for (let i = 0; i < count; i++) {
      const nextStart = new Date(currentStart);
      const nextEnd = new Date(currentEnd);

      if (series.recurrenceType === "DAILY") {
        nextStart.setDate(nextStart.getDate() + 1);
        nextEnd.setDate(nextEnd.getDate() + 1);
      } else if (series.recurrenceType === "WEEKLY") {
        nextStart.setDate(nextStart.getDate() + 7);
        nextEnd.setDate(nextEnd.getDate() + 7);
      } else if (series.recurrenceType === "BIWEEKLY") {
        nextStart.setDate(nextStart.getDate() + 14);
        nextEnd.setDate(nextEnd.getDate() + 14);
      } else if (series.recurrenceType === "MONTHLY") {
        nextStart.setMonth(nextStart.getMonth() + 1);
        nextEnd.setMonth(nextEnd.getMonth() + 1);
      }

      if (series.recurrenceEndDate && nextStart > series.recurrenceEndDate) {
        break;
      }

      const newSlug = `${latestEvent.slug}-${nanoid(6)}`;

      await prisma.$transaction(async (tx) => {
        const newEvent = await tx.event.create({
          data: {
            organizerProfileId: latestEvent.organizerProfileId,
            seriesId: id,
            categoryId: latestEvent.categoryId,
            venueId: latestEvent.venueId,
            countryId: latestEvent.countryId,
            stateId: latestEvent.stateId,
            cityId: latestEvent.cityId,
            title: latestEvent.title,
            slug: newSlug,
            description: latestEvent.description,
            heroImage: latestEvent.heroImage,
            images: latestEvent.images,
            contactEmail: latestEvent.contactEmail,
            contactPhone: latestEvent.contactPhone,
            startAt: nextStart,
            endAt: nextEnd,
            timezone: latestEvent.timezone,
            status: "DRAFT",
            currency: latestEvent.currency,
            commissionPct: latestEvent.commissionPct,
            gstPct: latestEvent.gstPct,
            platformFeeFixed: latestEvent.platformFeeFixed,
            tags: latestEvent.tags,
            audience: latestEvent.audience,
            videoUrl: latestEvent.videoUrl,
            lat: latestEvent.lat,
            lng: latestEvent.lng,
            cancelPolicy: latestEvent.cancelPolicy,
            refundPolicy: latestEvent.refundPolicy,
            cancellationDeadlineHours: latestEvent.cancellationDeadlineHours,
            refundPercent: latestEvent.refundPercent,
          },
        });

        if (latestEvent.ticketTypes.length > 0) {
          await tx.ticketType.createMany({
            data: latestEvent.ticketTypes.map((tt) => ({
              eventId: newEvent.id,
              name: tt.name,
              description: tt.description,
              kind: tt.kind,
              price: tt.price,
              quantity: tt.quantity,
              maxPerOrder: tt.maxPerOrder,
              isActive: tt.isActive,
              sortOrder: tt.sortOrder,
              sectionId: tt.sectionId,
            })),
          });
        }
      });

      currentStart = nextStart;
      currentEnd = nextEnd;
      createdCount++;
    }

    return ok({ created: createdCount });
  } catch (error) {
    console.error("[app/api/organizer/series/[id]/generate/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to generate events" });
  }
}
