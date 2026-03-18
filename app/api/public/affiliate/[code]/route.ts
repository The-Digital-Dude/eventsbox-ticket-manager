import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;

    const link = await prisma.affiliateLink.findUnique({
      where: { code, isActive: true },
      include: { event: { select: { slug: true } } },
    });

    if (!link) {
      return fail(404, { code: "NOT_FOUND", message: "Affiliate code not found or inactive" });
    }

    await prisma.affiliateLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    });

    return ok({
      eventId: link.eventId,
      eventSlug: link.event?.slug ?? null,
    });
  } catch (error) {
    console.error("[GET /api/public/affiliate/[code]]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to track affiliate click" });
  }
}
