import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { slugify } from "@/src/lib/utils/slug";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const source = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
    });
    if (!source) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const newTitle = `${source.title} (Copy)`;
    const newEvent = await prisma.event.create({
      data: {
        organizerProfileId: profile.id,
        title: newTitle,
        slug: slugify(newTitle),
        description: source.description,
        heroImage: source.heroImage,
        categoryId: source.categoryId,
        venueId: source.venueId,
        stateId: source.stateId,
        cityId: source.cityId,
        contactEmail: source.contactEmail,
        contactPhone: source.contactPhone,
        cancelPolicy: source.cancelPolicy,
        refundPolicy: source.refundPolicy,
        startAt: source.startAt,
        endAt: source.endAt,
        timezone: source.timezone,
        commissionPct: source.commissionPct,
        gstPct: source.gstPct,
        platformFeeFixed: source.platformFeeFixed,
        status: "DRAFT",
        ticketTypes: {
          create: source.ticketTypes.map((tt) => ({
            name: tt.name,
            description: tt.description,
            kind: tt.kind,
            price: tt.price,
            quantity: tt.quantity,
            maxPerOrder: tt.maxPerOrder,
            isActive: tt.isActive,
            sortOrder: tt.sortOrder,
            saleStartAt: tt.saleStartAt,
            saleEndAt: tt.saleEndAt,
          })),
        },
      },
      select: { id: true, title: true, slug: true, status: true },
    });

    return ok(newEvent, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHENTICATED") return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    if (msg === "FORBIDDEN") return fail(403, { code: "FORBIDDEN", message: "Access denied" });
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to duplicate event" });
  }
}
