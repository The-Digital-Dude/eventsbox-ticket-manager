import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail } from "@/src/lib/http/response";

function csvEscape(value: string) {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      select: { id: true, slug: true },
    });
    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const orders = await prisma.order.findMany({
      where: {
        eventId: event.id,
        status: "PAID",
      },
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        paidAt: true,
        items: {
          select: {
            ticketType: {
              select: { name: true },
            },
            tickets: {
              select: {
                ticketNumber: true,
                checkedInAt: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    const header = [
      "Ticket Number",
      "Buyer Name",
      "Buyer Email",
      "Ticket Type",
      "Checked In",
      "Check-in Time",
      "Order ID",
      "Paid At",
    ];
    const rows = [header.join(",")];

    for (const order of orders) {
      for (const item of order.items) {
        for (const ticket of item.tickets) {
          rows.push([
            csvEscape(ticket.ticketNumber),
            csvEscape(order.buyerName),
            csvEscape(order.buyerEmail),
            csvEscape(item.ticketType.name),
            csvEscape(ticket.checkedInAt ? "Yes" : "No"),
            csvEscape(ticket.checkedInAt ? ticket.checkedInAt.toISOString() : ""),
            csvEscape(order.id),
            csvEscape(order.paidAt ? order.paidAt.toISOString() : ""),
          ].join(","));
        }
      }
    }

    const csv = rows.join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=\"attendees-${event.slug}.csv\"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/events/[id]/attendees/export/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to export attendees" });
  }
}
