import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { sendMonthlyRevenueReport } from "@/src/lib/services/notifications";

const schema = z.object({
  organizerProfileId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must use YYYY-MM"),
});

function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid monthly report payload",
        details: parsed.error.flatten(),
      });
    }

    const organizer = await prisma.organizerProfile.findUnique({
      where: { id: parsed.data.organizerProfileId },
      select: {
        id: true,
        brandName: true,
        companyName: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!organizer) {
      return fail(404, { code: "NOT_FOUND", message: "Organizer not found" });
    }

    const { start, end } = monthRange(parsed.data.month);
    const orders = await prisma.order.findMany({
      where: {
        status: "PAID",
        event: {
          organizerProfileId: organizer.id,
        },
        paidAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        total: true,
        platformFee: true,
        event: {
          select: {
            title: true,
          },
        },
      },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const platformFeeDeducted = orders.reduce((sum, order) => sum + Number(order.platformFee), 0);
    const eventRevenue = new Map<string, { title: string; revenue: number }>();
    for (const order of orders) {
      const key = order.event.title;
      const existing = eventRevenue.get(key) ?? { title: key, revenue: 0 };
      existing.revenue += Number(order.total);
      eventRevenue.set(key, existing);
    }
    const topEvent = [...eventRevenue.values()].sort((a, b) => b.revenue - a.revenue)[0] ?? null;

    await sendMonthlyRevenueReport({
      organizerEmail: organizer.user.email,
      brandName: organizer.brandName || organizer.companyName || organizer.user.email,
      month: parsed.data.month,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders: orders.length,
      topEvent: topEvent ? { title: topEvent.title, revenue: Number(topEvent.revenue.toFixed(2)) } : null,
      platformFeeDeducted: Number(platformFeeDeducted.toFixed(2)),
    });

    return ok({
      sent: true,
      email: organizer.user.email,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Super admin access required" });
    }

    console.error("[app/api/admin/reports/send-monthly/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to send monthly revenue report" });
  }
}
