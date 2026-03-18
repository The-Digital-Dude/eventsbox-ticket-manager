import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireScannerOrOrganizer } from "@/src/lib/auth/guards";
import { fail } from "@/src/lib/http/response";

export async function getScannerAccess(req: NextRequest) {
  return requireScannerOrOrganizer(req);
}

export async function getScopedEvent(eventId: string, organizerProfileId: string) {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      organizerProfileId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      startAt: true,
      endAt: true,
    },
  });
}

export function scannerAccessErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return fail(403, { code: "FORBIDDEN", message: "Scanner or organizer access required" });
  }

  if (
    error instanceof Error &&
    (error.message === "PROFILE_NOT_FOUND" || error.message === "SCANNER_PROFILE_NOT_FOUND")
  ) {
    return fail(404, { code: "PROFILE_NOT_FOUND", message: "Scanner scope not found" });
  }

  return null;
}
