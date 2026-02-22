import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireRole } from "@/src/lib/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    return ok({ status: profile?.approvalStatus ?? "DRAFT", reason: profile?.rejectionReason ?? null });
  } catch {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}
