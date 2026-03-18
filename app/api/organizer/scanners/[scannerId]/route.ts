import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const updateScannerSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ scannerId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { scannerId } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Organizer profile not found" });

    const scanner = await prisma.scannerProfile.findFirst({
      where: { id: scannerId, organizerProfileId: profile.id },
    });
    if (!scanner) return fail(404, { code: "NOT_FOUND", message: "Scanner not found" });
    
    const parsed = updateScannerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payload" });
    }

    await prisma.user.update({
      where: { id: scanner.userId },
      data: { isActive: parsed.data.isActive },
    });

    return ok({ updated: true });
  } catch (error) {
    console.error("[PATCH /api/organizer/scanners/[scannerId]]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update scanner" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ scannerId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { scannerId } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Organizer profile not found" });

    const scanner = await prisma.scannerProfile.findFirst({
      where: { id: scannerId, organizerProfileId: profile.id },
    });
    if (!scanner) return fail(404, { code: "NOT_FOUND", message: "Scanner not found" });

    await prisma.user.delete({ where: { id: scanner.userId } });

    return ok({ deleted: true });
  } catch (error) {
    console.error("[DELETE /api/organizer/scanners/[scannerId]]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to delete scanner" });
  }
}
