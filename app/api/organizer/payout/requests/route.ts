import { NextRequest } from "next/server";
import { PayoutRequestStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireRole } from "@/src/lib/auth/guards";
import { payoutRequestSchema } from "@/src/lib/validators/organizer";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const requests = await prisma.payoutRequest.findMany({
      where: { organizerProfileId: profile.id },
      orderBy: { requestedAt: "desc" },
    });

    return ok(requests);
  } catch {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const parsed = payoutRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payout request payload", details: parsed.error.flatten() });
    }

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      include: { payoutSettings: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const isManualMode = profile.payoutSettings?.payoutMode ? profile.payoutSettings.payoutMode === "MANUAL" : true;
    if (!isManualMode) {
      return fail(400, {
        code: "NOT_MANUAL_MODE",
        message: "Payout requests are only available for manual payout mode",
      });
    }

    const existingPending = await prisma.payoutRequest.findFirst({
      where: {
        organizerProfileId: profile.id,
        status: PayoutRequestStatus.PENDING,
      },
      select: { id: true },
    });

    if (existingPending) {
      return fail(409, {
        code: "PENDING_REQUEST_EXISTS",
        message: "You already have a pending payout request",
      });
    }

    const created = await prisma.payoutRequest.create({
      data: {
        organizerProfileId: profile.id,
        amount: parsed.data.amount,
        note: parsed.data.note,
      },
    });

    return ok(created, 201);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create payout request" });
  }
}
