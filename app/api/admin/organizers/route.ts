import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const status = req.nextUrl.searchParams.get("status") ?? undefined;

    const items = await prisma.organizerProfile.findMany({
      where: status ? { approvalStatus: status as never } : undefined,
      include: { user: { select: { id: true, email: true, isActive: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return ok(items);
  } catch {
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
