import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

function isAuthorizedCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCron(req)) {
      return fail(401, { code: "UNAUTHORIZED", message: "Cron authorization failed" });
    }

    const now = new Date();
    const [refreshDeleted, verifyDeleted, resetDeleted] = await Promise.all([
      prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }],
        },
      }),
      prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    return ok({
      deleted: {
        refreshTokens: refreshDeleted.count,
        verifyTokens: verifyDeleted.count,
        resetTokens: resetDeleted.count,
      },
    });
  } catch (error) {
    console.error("[app/api/cron/cleanup-tokens/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to clean up expired tokens" });
  }
}
