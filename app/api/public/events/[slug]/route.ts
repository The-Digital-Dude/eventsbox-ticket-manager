import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: { select: { id: true, name: true } },
      venue: { select: { id: true, name: true, addressLine1: true } },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          kind: true,
          price: true,
          quantity: true,
          sold: true,
          maxPerOrder: true,
          saleStartAt: true,
          saleEndAt: true,
        },
      },
      organizerProfile: {
        select: {
          companyName: true,
          brandName: true,
          website: true,
          supportEmail: true,
        },
      },
    },
  });

  if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

  return ok(event);
}
