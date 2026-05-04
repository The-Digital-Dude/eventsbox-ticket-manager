import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail } from "@/src/lib/http/response";
import { getOrganizerAnalyticsData } from "@/src/lib/analytics/organizer";
import { ReportPdf } from "@/src/lib/pdf/report-pdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) return fail(400, { code: "EVENT_ID_REQUIRED", message: "eventId is required" });

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerProfileId: profile.id },
      select: {
        title: true,
        startAt: true,
        endAt: true,
        status: true,
        venue: { select: { name: true } },
      },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const [analytics, totalIssued, checkedIn] = await Promise.all([
      getOrganizerAnalyticsData({ organizerProfileId: profile.id, months: 12, eventId }),
      prisma.qRTicket.count({ where: { order: { eventId, status: "PAID" } } }),
      prisma.qRTicket.count({
        where: {
          order: { eventId, status: "PAID" },
          OR: [{ isCheckedIn: true }, { checkedInAt: { not: null } }],
        },
      }),
    ]);

    const pdfDocument = createElement(ReportPdf, {
      event,
      analytics,
      attendance: {
        totalIssued,
        checkedIn,
        noShows: Math.max(totalIssued - checkedIn, 0),
        checkInRate: totalIssued > 0 ? Math.round((checkedIn / totalIssued) * 100) : 0,
      },
    }) as Parameters<typeof renderToBuffer>[0];
    const pdf = await renderToBuffer(pdfDocument);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="event-report-${eventId}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Organizer only" });
    if (authResponse) return authResponse;
    console.error("[api/organizer/export/report-pdf] failed", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to export report PDF" });
  }
}
