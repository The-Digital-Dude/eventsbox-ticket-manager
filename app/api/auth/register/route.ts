import crypto from "crypto";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { registerSchema } from "@/src/lib/validators/auth";
import { hashPassword } from "@/src/lib/auth/password";
import { rateLimitRedis } from "@/src/lib/http/rate-limit-redis";
import { env } from "@/src/lib/env";
import { sendWelcomeEmail } from "@/src/lib/services/notifications";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = await rateLimitRedis(`register:${ip}`, 10, 60_000);
    if (rl.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many attempts" });
    }

    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return fail(409, { code: "EMAIL_EXISTS", message: "Email already registered" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: Role.ORGANIZER,
        organizerProfile: {
          create: {},
        },
      },
      include: { organizerProfile: true },
    });

    const verifyToken = crypto.randomBytes(24).toString("hex");
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });

    const verifyUrl = `${env.APP_URL}/auth/verify-email?token=${verifyToken}`;
    void sendWelcomeEmail({ to: user.email, verifyUrl }).catch((error) => {
      console.error("Welcome email dispatch failed:", error);
    });

    return ok({ userId: user.id, email: user.email, verifyTokenDev: verifyToken }, 201);
  } catch (error) {
    console.error("[app/api/auth/register/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to register" });
  }
}
