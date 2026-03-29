import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAttendee(req);
    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return ok({ updated: result.count });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Attendee account required" });
    if (authResponse) return authResponse;

    console.error("[app/api/account/notifications/read/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update notifications" });
  }
}
