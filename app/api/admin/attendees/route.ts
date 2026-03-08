import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const PAGE_SIZE = 20;

function parsePage(raw: string | null) {
  const parsed = Number(raw ?? "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);

    const page = parsePage(req.nextUrl.searchParams.get("page"));
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const status = req.nextUrl.searchParams.get("status")?.trim() ?? "";
    if (status && status !== "active" && status !== "suspended") {
      return fail(400, { code: "INVALID_STATUS", message: "Status must be active or suspended" });
    }

    const where = {
      role: Role.ATTENDEE,
      ...(q ? { email: { contains: q, mode: "insensitive" as const } } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "suspended" ? { isActive: false } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          createdAt: true,
          emailVerified: true,
          isActive: true,
          attendeeProfile: {
            select: {
              displayName: true,
              _count: { select: { orders: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.user.count({ where }),
    ]);

    const items = users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.attendeeProfile?.displayName ?? null,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      orderCount: user.attendeeProfile?._count.orders ?? 0,
    }));

    return ok({
      items,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Admin access required" });
    }

    console.error("[app/api/admin/attendees/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load attendees" });
  }
}
