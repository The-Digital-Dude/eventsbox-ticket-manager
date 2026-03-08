import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { verifyOtpSchema } from "@/src/lib/validators/auth";

export async function POST(req: NextRequest) {
  try {
    const parsed = verifyOtpSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid input" });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      return fail(400, { code: "INVALID_CODE", message: "Invalid or expired code" });
    }

    const row = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        token: parsed.data.code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!row) {
      return fail(400, { code: "INVALID_CODE", message: "Invalid or expired code" });
    }

    await prisma.$transaction([
      prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
    ]);

    return ok({ verified: true });
  } catch (error) {
    console.error("[app/api/auth/verify-email/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to verify email" });
  }
}
