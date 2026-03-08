import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { verifyEmailSchema } from "@/src/lib/validators/auth";

export async function POST(req: NextRequest) {
  try {
    const parsed = verifyEmailSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid token" });
    }

    const row = await prisma.emailVerificationToken.findUnique({ where: { token: parsed.data.token } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return fail(400, { code: "INVALID_TOKEN", message: "Token invalid or expired" });
    }

    await prisma.$transaction([
      prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: row.userId }, data: { emailVerified: true } }),
    ]);

    return ok({ verified: true });
  } catch (error) {
    console.error("[app/api/auth/verify-email/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to verify email" });
  }
}
