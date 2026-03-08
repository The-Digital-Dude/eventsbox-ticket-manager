import { NextRequest } from "next/server";
import { EventStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const rawStatus = req.nextUrl.searchParams.get("status")?.trim();
    const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;

    if (rawStatus && !Object.values(EventStatus).includes(rawStatus as EventStatus)) {
      return fail(400, { code: "INVALID_STATUS", message: "Invalid event status" });
    }

    const events = await prisma.event.findMany({
      where: {
        ...(rawStatus ? { status: rawStatus as EventStatus } : {}),
        ...(q ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { organizerProfile: { user: { email: { contains: q, mode: "insensitive" } } } },
            { organizerProfile: { companyName: { contains: q, mode: "insensitive" } } },
          ],
        } : {}),
      },
      include: {
        organizerProfile: { include: { user: { select: { email: true } } } },
        category: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        _count: { select: { ticketTypes: true, orders: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return ok(events);
  } catch (error) {
    console.error("[app/api/admin/events/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
