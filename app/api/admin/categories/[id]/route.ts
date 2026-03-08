import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { categorySchema } from "@/src/lib/validators/admin";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;
    const parsed = categorySchema.safeParse(await req.json());

    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid category payload" });
    }

    const row = await prisma.category.update({ where: { id }, data: parsed.data });
    return ok(row);
  } catch (error) {
    console.error("[app/api/admin/categories/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update category" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;
    await prisma.category.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    console.error("[app/api/admin/categories/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to delete category" });
  }
}
