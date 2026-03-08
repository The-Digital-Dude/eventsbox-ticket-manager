import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { rateLimit } from "@/src/lib/http/rate-limit";
import { z } from "zod";

const schema = z.object({ email: z.email() });

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimit(`ticket-lookup:${ip}`, 15, 60_000);
    if (rl.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many lookup attempts. Try again in a minute." });
    }

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
