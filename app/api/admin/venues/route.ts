import { NextRequest } from "next/server";
import { Role, VenueStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const rawStatus = req.nextUrl.searchParams.get("status");
    const status = rawStatus?.trim() || undefined;
    const rawQ = req.nextUrl.searchParams.get("q");
    const q = rawQ?.trim() || undefined;

    if (status && !Object.values(VenueStatus).includes(status as VenueStatus)) {
      return fail(400, { code: "INVALID_STATUS", message: "Invalid status value" });
    }

    const includeLayout = req.nextUrl.searchParams.get("includeLayout") === "true";
    const rows = await prisma.venue.findMany({
      where: {
        isEventOnly: false,
        ...(status ? { status: status as VenueStatus } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { organizerProfile: { user: { email: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
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
  } catch (error) {
    console.error("[app/api/admin/venues/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
