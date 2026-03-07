import { NextRequest } from "next/server";
import { OrganizerApprovalStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const rawStatus = req.nextUrl.searchParams.get("status");
    const status = rawStatus?.trim() || undefined;
    const rawQ = req.nextUrl.searchParams.get("q");
    const q = rawQ?.trim() || undefined;

    if (status && !Object.values(OrganizerApprovalStatus).includes(status as OrganizerApprovalStatus)) {
      return fail(400, { code: "INVALID_STATUS", message: "Invalid status value" });
    }

    const items = await prisma.organizerProfile.findMany({
      where: {
        ...(status ? { approvalStatus: status as OrganizerApprovalStatus } : {}),
        ...(q
          ? {
              OR: [
                { user: { email: { contains: q, mode: "insensitive" } } },
                { companyName: { contains: q, mode: "insensitive" } },
                { brandName: { contains: q, mode: "insensitive" } },
                { contactName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { user: { select: { id: true, email: true, isActive: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return ok(items);
  } catch {
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
