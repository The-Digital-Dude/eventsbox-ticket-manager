import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

function getPeriod(yearValue: string | null, quarterValue: string | null) {
  const year = Number.parseInt(yearValue ?? "", 10);
  if (!Number.isFinite(year)) return null;

  const quarter = quarterValue ? Number.parseInt(quarterValue, 10) : undefined;
  if (quarter !== undefined && ![1, 2, 3, 4].includes(quarter)) return null;

  if (!quarter) {
    return {
      from: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
      to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      label: `${year}`,
      filename: `tax-report-${year}.csv`,
    };
  }

  const startMonth = (quarter - 1) * 3;
  return {
    from: new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999)),
    label: `${year} Q${quarter}`,
    filename: `tax-report-${year}-Q${quarter}.csv`,
  };
}

function escapeCsv(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const period = getPeriod(
      req.nextUrl.searchParams.get("year"),
      req.nextUrl.searchParams.get("quarter"),
    );

    if (!period) {
      return fail(400, { code: "INVALID_PERIOD", message: "Valid year and quarter are required" });
    }

    const orders = await prisma.order.findMany({
      where: {
        status: "PAID",
        paidAt: {
          gte: period.from,
          lte: period.to,
        },
      },
      select: {
        id: true,
        total: true,
        gst: true,
        subtotal: true,
        platformFee: true,
        paidAt: true,
        buyerEmail: true,
        event: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { paidAt: "asc" },
    });

    const summary = {
      totalGST: orders.reduce((sum, order) => sum + Number(order.gst), 0),
      totalRevenue: orders.reduce((sum, order) => sum + Number(order.total), 0),
      totalOrders: orders.length,
      period: period.label,
    };

    if (req.nextUrl.searchParams.get("format") === "json") {
      return ok({
        orders: orders.map((order) => ({
          ...order,
          total: Number(order.total),
          gst: Number(order.gst),
          subtotal: Number(order.subtotal),
          platformFee: Number(order.platformFee),
        })),
        summary,
      });
    }

    const header = [
      "Order ID",
      "Event",
      "Buyer Email",
      "Subtotal",
      "GST",
      "Platform Fee",
      "Total",
      "Paid At",
    ].join(",");

    const rows = orders.map((order) =>
      [
        escapeCsv(order.id),
        escapeCsv(order.event.title),
        escapeCsv(order.buyerEmail),
        escapeCsv(Number(order.subtotal).toFixed(2)),
        escapeCsv(Number(order.gst).toFixed(2)),
        escapeCsv(Number(order.platformFee).toFixed(2)),
        escapeCsv(Number(order.total).toFixed(2)),
        escapeCsv(order.paidAt?.toISOString() ?? ""),
      ].join(","),
    );

    return new Response([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${period.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Admin only" });
    }

    console.error("[app/api/admin/reports/tax/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to generate tax report" });
  }
}
