import { CancellationRequestStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const statusParam = req.nextUrl.searchParams.get("status");
    let statusFilter: CancellationRequestStatus | undefined;
    if (statusParam) {
      const normalized = statusParam.toUpperCase();
      if (!Object.values(CancellationRequestStatus).includes(normalized as CancellationRequestStatus)) {
        return fail(400, { code: "INVALID_STATUS", message: "Invalid cancellation request status" });
      }
      statusFilter = normalized as CancellationRequestStatus;
    }

    const requests = await prisma.cancellationRequest.findMany({
      where: {
        order: {
          event: {
            organizerProfileId: profile.id,
          },
        },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      select: {
        id: true,
        orderId: true,
        reason: true,
        status: true,
        adminNote: true,
        createdAt: true,
        resolvedAt: true,
        order: {
          select: {
            buyerEmail: true,
            buyerName: true,
            total: true,
            status: true,
            event: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(requests);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/cancellation-requests/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load cancellation requests" });
  }
}
