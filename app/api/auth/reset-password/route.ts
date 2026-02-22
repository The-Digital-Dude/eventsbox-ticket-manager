import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { resetPasswordSchema } from "@/src/lib/validators/auth";

export async function POST(req: NextRequest) {
  try {
    const parsed = resetPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid email" });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      return ok({ sent: true });
    }

    const token = crypto.randomBytes(24).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return ok({ sent: true, resetTokenDev: token });
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create reset token" });
  }
}
