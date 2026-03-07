import { NextRequest } from "next/server";
import { PayoutRequestStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const rawStatus = req.nextUrl.searchParams.get("status");
    const status = rawStatus?.trim() || undefined;

    if (status && !Object.values(PayoutRequestStatus).includes(status as PayoutRequestStatus)) {
      return fail(400, { code: "INVALID_STATUS", message: "Invalid payout request status" });
    }

    const requests = await prisma.payoutRequest.findMany({
      where: status ? { status: status as PayoutRequestStatus } : undefined,
      include: {
        organizerProfile: {
          select: {
            id: true,
            companyName: true,
            brandName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    return ok(requests);
  } catch {
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
