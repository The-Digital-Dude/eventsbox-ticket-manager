import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { resendOtpSchema } from "@/src/lib/validators/auth";
import { rateLimitRedis } from "@/src/lib/http/rate-limit-redis";
import { sendWelcomeEmail } from "@/src/lib/services/notifications";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = await rateLimitRedis(`resend-otp:${ip}`, 5, 60_000);
    if (rl.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many attempts" });
    }

    const parsed = resendOtpSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid input" });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || user.emailVerified) {
      // Return ok silently to avoid email enumeration
      return ok({ sent: true });
    }

    // Invalidate existing tokens
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    void sendWelcomeEmail({ to: user.email, otp }).catch((error) => {
      console.error("Resend OTP email failed:", error);
    });

    return ok({ sent: true });
  } catch (error) {
    console.error("[app/api/auth/verify-email/resend/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to resend code" });
  }
}
