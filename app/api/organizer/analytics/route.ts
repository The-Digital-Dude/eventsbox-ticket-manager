import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";
import { getOrganizerAnalyticsData } from "@/src/lib/analytics/organizer";

function parseMonths(raw: string | null) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 12;
  if ([3, 6, 12, 24].includes(value)) return value;
  return 12;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const months = parseMonths(req.nextUrl.searchParams.get("months"));
    const eventId = req.nextUrl.searchParams.get("eventId");

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Profile not found" });

    const analytics = await getOrganizerAnalyticsData({
      organizerProfileId: profile.id,
      months,
      eventId,
    });

    return ok(analytics);
  } catch (err) {
    const authResponse = authErrorResponse(err, { forbiddenMessage: "Access denied" });
    if (authResponse) return authResponse;
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to fetch analytics" });
  }
}
