import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { configSchema } from "@/src/lib/validators/admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.SUPER_ADMIN);
    const row = await prisma.platformConfig.findUnique({ where: { id: "singleton" } });
    return ok({ ...row, viewerRole: auth.role });
  } catch (error) {
    console.error("[app/api/admin/config/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const parsed = configSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid config payload" });
    }

    const row = await prisma.platformConfig.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });

    return ok(row);
  } catch (error) {
    console.error("[app/api/admin/config/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update config" });
  }
}
