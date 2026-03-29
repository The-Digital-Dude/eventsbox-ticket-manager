import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const { id } = await params;

    const existing = await prisma.notification.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return fail(404, { code: "NOT_FOUND", message: "Notification not found" });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        actionUrl: true,
        isRead: true,
        createdAt: true,
      },
    });

    return ok(notification);
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Attendee account required" });
    if (authResponse) return authResponse;

    console.error("[app/api/account/notifications/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update notification" });
  }
}
