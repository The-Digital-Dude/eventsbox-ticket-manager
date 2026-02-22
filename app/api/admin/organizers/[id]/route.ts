import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const row = await prisma.organizerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, emailVerified: true, isActive: true } },
        payoutSettings: true,
        venues: { include: { state: true, city: true } },
      },
    });

    if (!row) {
      return fail(404, { code: "NOT_FOUND", message: "Organizer not found" });
    }

    return ok(row);
  } catch {
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}
