import { NextRequest } from "next/server";
import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

const PAGE_SIZE = 20;

function parsePage(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);

    const page = parsePage(req.nextUrl.searchParams.get("page"));
    const rawStatus = req.nextUrl.searchParams.get("status")?.trim() || undefined;
    const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;

    if (rawStatus && !Object.values(OrderStatus).includes(rawStatus as OrderStatus)) {
      return fail(400, { code: "INVALID_STATUS", message: "Invalid order status" });
    }

    const where = {
      ...(rawStatus ? { status: rawStatus as OrderStatus } : {}),
      ...(q ? { buyerEmail: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          buyerEmail: true,
          buyerName: true,
          total: true,
          status: true,
          paidAt: true,
          createdAt: true,
          event: { select: { id: true, title: true, slug: true } },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.order.count({ where }),
    ]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return ok({
      items: orders,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        pages,
      },
    });
  } catch (error) {
    console.error("[app/api/admin/orders/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
