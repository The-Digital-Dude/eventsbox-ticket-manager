import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const includeLayout = req.nextUrl.searchParams.get("includeLayout") === "true";
    const rows = await prisma.venue.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        organizerProfile: { include: { user: { select: { email: true } } } },
        state: true,
        city: true,
        category: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!includeLayout) {
      return ok(
        rows.map((row) => ({
          ...row,
          seatingConfig: undefined,
          seatState: undefined,
        })),
      );
    }
    return ok(rows);
  } catch {
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
