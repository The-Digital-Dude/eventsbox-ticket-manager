import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { ok, fail } from "@/src/lib/http/response";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(400, { code: "VALIDATION_ERROR", message: "token is required" });

    const { token } = parsed.data;

    const ticket = await prisma.qRTicket.findFirst({
      where: {
        OR: [{ id: token }, { token }],
      },
      include: {
        order: {
          include: {
            event: {
              include: {
                organizerProfile: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    if (!ticket) return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });

    if (ticket.order.event.organizerProfile.userId !== auth.sub) {
      return fail(403, { code: "FORBIDDEN", message: "Ticket does not belong to your events" });
    }

    if (ticket.order.status !== "PAID") {
      return fail(422, { code: "NOT_PAID", message: "Order is not paid" });
    }

    if (ticket.checkedInAt) {
      return ok({
        alreadyCheckedIn: true,
        checkedInAt: ticket.checkedInAt,
        ticketNumber: ticket.ticketNumber,
        eventTitle: ticket.order.event.title,
      });
    }

    const updated = await prisma.qRTicket.update({
      where: { id: ticket.id },
      data: { checkedInAt: new Date() },
    });

    return ok({
      alreadyCheckedIn: false,
      checkedInAt: updated.checkedInAt,
      ticketNumber: ticket.ticketNumber,
      eventTitle: ticket.order.event.title,
      buyerName: ticket.order.buyerName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHENTICATED") return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
    if (msg === "FORBIDDEN") return fail(403, { code: "FORBIDDEN", message: "Forbidden" });
    return fail(500, { code: "INTERNAL_ERROR", message: "Unexpected error" });
  }
}
