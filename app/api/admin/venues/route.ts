import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const rows = await prisma.venue.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        organizerProfile: { include: { user: { select: { email: true } } } },
        state: true,
        city: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows);
  } catch {
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
