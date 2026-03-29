import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
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
    await requireRole(req, Role.SUPER_ADMIN);
    const from = parseDate(req.nextUrl.searchParams.get("from"));
    const to = parseDate(req.nextUrl.searchParams.get("to"));

    if (!from || !to) {
      return fail(400, { code: "INVALID_PERIOD", message: "Valid from and to dates are required" });
    }

    const refunds = await prisma.order.findMany({
      where: {
        status: "REFUNDED",
        updatedAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        total: true,
        buyerEmail: true,
        buyerName: true,
        updatedAt: true,
        stripePaymentIntentId: true,
        event: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const header = [
      "Order ID",
      "Event",
      "Buyer",
      "Amount Refunded",
      "Stripe PI ID",
      "Refunded At",
    ].join(",");

    const rows = refunds.map((refund) =>
      [
        escapeCsv(refund.id),
        escapeCsv(refund.event.title),
        escapeCsv(`${refund.buyerName} <${refund.buyerEmail}>`),
        escapeCsv(Number(refund.total).toFixed(2)),
        escapeCsv(refund.stripePaymentIntentId ?? ""),
        escapeCsv(refund.updatedAt.toISOString()),
      ].join(","),
    );

    return new Response([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="refund-report.csv"',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Admin only" });
    }

    console.error("[app/api/admin/reports/refunds/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to generate refund report" });
  }
}
