import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireAttendee } from "@/src/lib/auth/require-attendee";

const profilePatchSchema = z.object({
  displayName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  marketingOptOut: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAttendee(req);
    const [profile, user] = await Promise.all([
      prisma.attendeeProfile.findUnique({ where: { userId: session.user.id } }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { marketingOptOut: true },
      }),
    ]);

    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }

    return ok({
      email: session.user.email,
      displayName: profile.displayName,
      phone: profile.phone,
      marketingOptOut: user?.marketingOptOut ?? false,
      createdAt: profile.createdAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Attendee account required" });
    }

    console.error("[app/api/account/profile/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load profile" });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAttendee(req);
    const parsed = profilePatchSchema.safeParse(await req.json());

    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const updatedProfile = await prisma.attendeeProfile.update({
      where: { userId: session.user.id },
      data: {
        displayName: parsed.data.displayName,
        phone: parsed.data.phone,
      },
      select: { displayName: true, phone: true },
    });

    if (parsed.data.marketingOptOut !== undefined) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { marketingOptOut: parsed.data.marketingOptOut },
      });
    }

    return ok({
      ...updatedProfile,
      marketingOptOut: parsed.data.marketingOptOut ?? undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Attendee account required" });
    }

    console.error("[app/api/account/profile/route.ts][PATCH]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update profile" });
  }
}
