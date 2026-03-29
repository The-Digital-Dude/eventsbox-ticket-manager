import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireApprovedOrganizer } from "@/src/lib/auth/guards";
import { fail } from "@/src/lib/http/response";

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function escapeCsv(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireApprovedOrganizer(req);
    const from = parseDate(req.nextUrl.searchParams.get("from"));
    const to = parseDate(req.nextUrl.searchParams.get("to"));

    const orders = await prisma.order.findMany({
      where: {
        status: "PAID",
        event: {
          organizerProfileId: profile.id,
        },
        ...(from || to
          ? {
              paidAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        total: true,
        status: true,
        paidAt: true,
        event: {
          select: {
            title: true,
          },
        },
        items: {
          select: {
            ticketType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    const header = [
      "Order ID",
      "Event Title",
      "Buyer Name",
      "Buyer Email",
      "Total",
      "Status",
      "Ticket Types",
      "Paid At",
    ].join(",");

    const rows = orders.map((order) =>
      [
        escapeCsv(order.id),
        escapeCsv(order.event.title),
        escapeCsv(order.buyerName),
        escapeCsv(order.buyerEmail),
        escapeCsv(Number(order.total).toFixed(2)),
        escapeCsv(order.status),
        escapeCsv(order.items.map((item) => item.ticketType.name).join(" | ")),
        escapeCsv(order.paidAt?.toISOString() ?? ""),
      ].join(","),
    );

    return new Response([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="orders.csv"',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }
    if (error instanceof Error && error.message === "ORGANIZER_NOT_APPROVED") {
      return fail(403, { code: "ORGANIZER_NOT_APPROVED", message: "Approved organizer account required" });
    }

    console.error("[app/api/organizer/export/orders/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to export orders" });
  }
}
