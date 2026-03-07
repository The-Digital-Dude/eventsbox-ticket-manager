import { NextRequest } from "next/server";
import { PayoutRequestStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { payoutDecisionSchema } from "@/src/lib/validators/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const parsed = payoutDecisionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payout decision payload", details: parsed.error.flatten() });
    }

    const existing = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!existing) {
      return fail(404, { code: "NOT_FOUND", message: "Payout request not found" });
    }

    if (parsed.data.action === PayoutRequestStatus.PAID) {
      if (!(existing.status === PayoutRequestStatus.APPROVED || existing.status === PayoutRequestStatus.PENDING)) {
        return fail(400, {
          code: "INVALID_TRANSITION",
          message: "Only approved or pending requests can be marked as paid",
        });
      }
    }

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status: parsed.data.action,
        resolvedAt: new Date(),
        adminNote: parsed.data.adminNote ?? undefined,
      },
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
    });

    return ok(updated);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to apply payout decision" });
  }
}
