import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";

const PAGE_SIZE = 20;

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAttendee(req);
    const profile = await prisma.attendeeProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }

    const pageParam = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const unreadOnly = parseBoolean(req.nextUrl.searchParams.get("unreadOnly"));

    const where = {
      userId: session.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          actionUrl: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false,
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return ok({
      notifications,
      unreadCount,
      total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Attendee account required" });
    if (authResponse) return authResponse;

    console.error("[app/api/account/notifications/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load notifications" });
  }
}
