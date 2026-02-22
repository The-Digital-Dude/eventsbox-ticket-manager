import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireRole } from "@/src/lib/auth/guards";
import { payoutSchema } from "@/src/lib/validators/organizer";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const settings = await prisma.organizerPayoutSettings.findUnique({ where: { organizerProfileId: profile.id } });
    return ok(settings);
  } catch {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const parsed = payoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payout settings", details: parsed.error.flatten() });
    }

    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const row = await prisma.organizerPayoutSettings.upsert({
      where: { organizerProfileId: profile.id },
      update: {
        payoutMode: parsed.data.payoutMode,
        manualPayoutNote: parsed.data.manualPayoutNote,
      },
      create: {
        organizerProfileId: profile.id,
        payoutMode: parsed.data.payoutMode,
        manualPayoutNote: parsed.data.manualPayoutNote,
      },
    });

    return ok(row);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update payout settings" });
  }
}
