import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { stateSchema } from "@/src/lib/validators/admin";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;
    const parsed = stateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid state payload" });
    }

    const row = await prisma.state.update({ where: { id }, data: parsed.data });
    return ok(row);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update state" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;
    await prisma.state.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to delete state" });
  }
}
