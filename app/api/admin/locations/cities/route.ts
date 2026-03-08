import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { citySchema } from "@/src/lib/validators/admin";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const rows = await prisma.city.findMany({ include: { state: true }, orderBy: { name: "asc" } });
    return ok(rows);
  } catch (error) {
    console.error("[app/api/admin/locations/cities/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const parsed = citySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid city payload" });
    }

    const row = await prisma.city.create({ data: parsed.data });
    return ok(row, 201);
  } catch (error) {
    console.error("[app/api/admin/locations/cities/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create city" });
  }
}
