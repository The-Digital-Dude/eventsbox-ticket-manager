import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { configSchema } from "@/src/lib/validators/admin";
import { PLATFORM_CONFIG_ID, getPlatformSettings } from "@/src/lib/services/platform-settings";
import { writeAuditLog } from "@/src/lib/services/audit";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.SUPER_ADMIN);
    const row = await getPlatformSettings();
    return ok({ ...row, viewerRole: auth.role });
  } catch (error) {
    console.error("[app/api/admin/config/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireRole(req, Role.SUPER_ADMIN);
    const parsed = configSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid config payload",
        details: parsed.error.flatten(),
      });
    }

    const previous = await getPlatformSettings();
    const row = await prisma.platformConfig.upsert({
      where: { id: PLATFORM_CONFIG_ID },
      update: parsed.data,
      create: { id: PLATFORM_CONFIG_ID, ...parsed.data },
    });

    const changedFields = Object.entries(parsed.data)
      .filter(([key, value]) => String(previous[key as keyof typeof previous] ?? "") !== String(value ?? ""))
      .map(([key]) => key);

    await writeAuditLog({
      actorUserId: actor.sub,
      action: "PLATFORM_CONFIG_UPDATED",
      entityType: "PlatformConfig",
      entityId: PLATFORM_CONFIG_ID,
      metadata: {
        changedFields,
        previousFinancials: {
          defaultCommissionType: previous.defaultCommissionType,
          defaultCommissionValue: previous.defaultCommissionValue,
          defaultTaxRate: previous.defaultTaxRate,
          defaultFeeStrategy: previous.defaultFeeStrategy,
        },
        nextFinancials: {
          defaultCommissionType: row.defaultCommissionType,
          defaultCommissionValue: Number(row.defaultCommissionValue),
          defaultTaxRate: Number(row.defaultTaxRate),
          defaultFeeStrategy: row.defaultFeeStrategy,
        },
      },
    });

    return ok(row);
  } catch (error) {
    console.error("[app/api/admin/config/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update config" });
  }
}
