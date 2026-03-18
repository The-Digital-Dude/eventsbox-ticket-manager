import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { hashPassword } from "@/src/lib/auth/password";

const createScannerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Organizer profile not found" });

    const scanners = await prisma.scannerProfile.findMany({
      where: { organizerProfileId: profile.id },
      include: { user: { select: { email: true, isActive: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok(scanners);
  } catch (error) {
    console.error("[GET /api/organizer/scanners]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to load scanners" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Organizer profile not found" });

    const parsed = createScannerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return fail(409, { code: "EMAIL_EXISTS", message: "Email already in use" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: Role.SCANNER,
        emailVerified: true,
        scannerProfile: {
          create: {
            organizerProfileId: profile.id,
          },
        },
      },
      include: {
        scannerProfile: {
          include: {
            user: { select: { email: true, isActive: true } },
          },
        },
      },
    });
    
    // We don't send a welcome email to scanners
    
    return ok(user.scannerProfile, 201);
  } catch (error) {
    console.error("[POST /api/organizer/scanners]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create scanner account" });
  }
}
