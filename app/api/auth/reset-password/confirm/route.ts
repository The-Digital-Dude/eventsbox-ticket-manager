import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { confirmResetSchema } from "@/src/lib/validators/auth";

export async function POST(req: NextRequest) {
  try {
    const parsed = confirmResetSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Token and password (min 8 chars) required" });
    }

    const { token, password } = parsed.data;

    const row = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return fail(400, { code: "INVALID_TOKEN", message: "Reset link is invalid or has expired" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      // Revoke all refresh tokens for security
      prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return ok({ reset: true });
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Password reset failed" });
  }
}
