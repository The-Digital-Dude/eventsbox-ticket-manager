import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail } from "@/src/lib/http/response";
import { loginSchema } from "@/src/lib/validators/auth";
import { verifyPassword } from "@/src/lib/auth/password";
import { issueSession } from "@/src/lib/auth/session";
import { rateLimitRedis } from "@/src/lib/http/rate-limit-redis";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = await rateLimitRedis(`login:${ip}`, 20, 60_000);
    if (rl.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many attempts" });
    }

    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const emailRl = await rateLimitRedis(`login:email:${parsed.data.email}`, 10, 300_000);
    if (emailRl.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many attempts" });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: { scannerProfile: true },
    });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return fail(401, { code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return fail(403, { code: "ACCOUNT_SUSPENDED", message: "Your account has been suspended." });
    }

    const tempResponse = NextResponse.json({});
    const { accessToken, refreshToken } = await issueSession({ id: user.id, email: user.email, role: user.role }, tempResponse);

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          scannerOrganizerProfileId: user.scannerProfile?.organizerProfileId ?? null,
        },
        accessToken,
        refreshToken,
        emailVerified: user.emailVerified,
      },
    });

    tempResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return response;
  } catch (error) {
    console.error("[app/api/auth/login/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to login" });
  }
}
