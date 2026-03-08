import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { z } from "zod";

const schema = z.object({ email: z.email() });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Valid email required" });
    }

    const orders = await prisma.order.findMany({
      where: {
        buyerEmail: parsed.data.email.toLowerCase(),
        status: { in: ["PAID", "REFUNDED"] },
      },
      select: {
        id: true,
        status: true,
        total: true,
        paidAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            startAt: true,
            status: true,
            venue: { select: { name: true } },
          },
        },
        items: {
          select: {
            quantity: true,
            ticketType: { select: { name: true } },
          },
        },
        _count: { select: { tickets: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 20,
    });

    return ok(orders);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Lookup failed" });
  }
}
