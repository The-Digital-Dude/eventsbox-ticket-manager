import { NextRequest } from "next/server";
import { OrderStatus, PayoutRequestStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";

type LedgerEntry = {
  id: string;
  date: string;
  type: "Sale" | "Refund" | "Platform Fee" | "Payout";
  description: string;
  amount: number;
  net: number;
};

function money(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

function parsePage(raw: string | null) {
  const page = Number(raw ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parsePageSize(raw: string | null) {
  const pageSize = Number(raw ?? 25);
  if (!Number.isFinite(pageSize)) return 25;
  return Math.min(Math.max(Math.floor(pageSize), 1), 100);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const page = parsePage(req.nextUrl.searchParams.get("page"));
    const pageSize = parsePageSize(req.nextUrl.searchParams.get("pageSize"));

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Organizer profile missing" });

    const [orders, payouts] = await Promise.all([
      prisma.order.findMany({
        where: {
          event: { organizerProfileId: profile.id },
          status: { in: [OrderStatus.PAID, OrderStatus.REFUNDED] },
        },
        select: {
          id: true,
          buyerName: true,
          total: true,
          platformFee: true,
          status: true,
          paidAt: true,
          updatedAt: true,
          createdAt: true,
          event: { select: { title: true } },
        },
      }),
      prisma.payoutRequest.findMany({
        where: {
          organizerProfileId: profile.id,
          status: PayoutRequestStatus.PAID,
        },
        select: {
          id: true,
          amount: true,
          note: true,
          resolvedAt: true,
          requestedAt: true,
        },
      }),
    ]);

    const entries: LedgerEntry[] = [];
    for (const order of orders) {
      const date = (order.paidAt ?? order.updatedAt ?? order.createdAt).toISOString();
      if (order.status === OrderStatus.PAID) {
        const gross = money(order.total);
        entries.push({
          id: `sale-${order.id}`,
          date,
          type: "Sale",
          description: `${order.event.title} · ${order.buyerName}`,
          amount: gross,
          net: gross,
        });

        const fee = money(order.platformFee);
        if (fee > 0) {
          entries.push({
            id: `fee-${order.id}`,
            date,
            type: "Platform Fee",
            description: `Platform fee for ${order.event.title}`,
            amount: -fee,
            net: -fee,
          });
        }
      } else if (order.status === OrderStatus.REFUNDED) {
        const refund = money(order.total);
        entries.push({
          id: `refund-${order.id}`,
          date,
          type: "Refund",
          description: `${order.event.title} · ${order.buyerName}`,
          amount: -refund,
          net: -refund,
        });
      }
    }

    for (const payout of payouts) {
      const amount = money(payout.amount);
      entries.push({
        id: `payout-${payout.id}`,
        date: (payout.resolvedAt ?? payout.requestedAt).toISOString(),
        type: "Payout",
        description: payout.note || "Organizer payout",
        amount: -amount,
        net: -amount,
      });
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const grossSales = orders
      .filter((order) => order.status === OrderStatus.PAID)
      .reduce((sum, order) => sum + money(order.total), 0);
    const totalFees = orders
      .filter((order) => order.status === OrderStatus.PAID)
      .reduce((sum, order) => sum + money(order.platformFee), 0);
    const totalRefunds = orders
      .filter((order) => order.status === OrderStatus.REFUNDED)
      .reduce((sum, order) => sum + money(order.total), 0);
    const totalPayouts = payouts.reduce((sum, payout) => sum + money(payout.amount), 0);

    const start = (page - 1) * pageSize;
    return ok({
      entries: entries.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: entries.length,
        totalPages: Math.max(Math.ceil(entries.length / pageSize), 1),
      },
      totals: {
        grossSales: money(grossSales),
        totalFees: money(totalFees),
        totalRefunds: money(totalRefunds),
        totalPayouts: money(totalPayouts),
        netAvailable: money(grossSales - totalFees - totalRefunds - totalPayouts),
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Organizer only" });
    if (authResponse) return authResponse;
    console.error("[api/organizer/payout/ledger] failed", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load payout ledger" });
  }
}
