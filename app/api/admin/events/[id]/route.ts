import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        venue: { select: { name: true, addressLine1: true } },
        state: { select: { name: true } },
        city: { select: { name: true } },
        organizerProfile: {
          select: {
            companyName: true,
            brandName: true,
            user: { select: { email: true } },
          },
        },
        ticketTypes: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true, name: true, kind: true, price: true,
            quantity: true, sold: true, isActive: true,
          },
        },
        orders: {
          where: { status: "PAID" },
          include: {
            items: {
              include: {
                ticketType: { select: { name: true } },
                tickets: { select: { id: true, ticketNumber: true, checkedInAt: true } },
              },
            },
          },
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    return ok(event);
  } catch (error) {
    console.error("[app/api/admin/events/[id]/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
