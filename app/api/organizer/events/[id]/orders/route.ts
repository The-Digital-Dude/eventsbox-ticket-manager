import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({ where: { id, organizerProfileId: profile.id } });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const orders = await prisma.order.findMany({
      where: { eventId: id, status: "PAID" },
      include: {
        items: { include: { ticketType: { select: { id: true, name: true } } } },
      },
      orderBy: { paidAt: "desc" },
    });

    return ok(orders);
  } catch {
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}
