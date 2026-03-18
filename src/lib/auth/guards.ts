import { NextRequest } from "next/server";
import { OrganizerApprovalStatus, Role } from "@prisma/client";
import { accessTokenFromRequest } from "@/src/lib/auth/session";
import { verifyAccessToken } from "@/src/lib/auth/jwt";
import { prisma } from "@/src/lib/db";

export async function requireAuth(req: NextRequest) {
  const token = accessTokenFromRequest(req);
  if (!token) {
    throw new Error("UNAUTHENTICATED");
  }
  const payload = verifyAccessToken(token);
  return payload;
}

export async function requireRole(req: NextRequest, role: Role) {
  const payload = await requireAuth(req);
  if (payload.role !== role) {
    throw new Error("FORBIDDEN");
  }
  return payload;
}

export async function requireApprovedOrganizer(req: NextRequest) {
  const payload = await requireRole(req, Role.ORGANIZER);
  const profile = await prisma.organizerProfile.findUnique({ where: { userId: payload.sub } });
  if (!profile || profile.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    throw new Error("ORGANIZER_NOT_APPROVED");
  }
  return { payload, profile };
}

export async function requireScanner(req: NextRequest) {
  const payload = await requireRole(req, Role.SCANNER);
  const profile = await prisma.scannerProfile.findUnique({ where: { userId: payload.sub } });
  if (!profile) {
    throw new Error("SCANNER_PROFILE_NOT_FOUND");
  }
  return { payload, profile };
}

export async function requireScannerOrOrganizer(req: NextRequest) {
  const payload = await requireAuth(req);

  if (payload.role === Role.SCANNER) {
    const profile = await prisma.scannerProfile.findUnique({ where: { userId: payload.sub } });
    if (!profile) {
      throw new Error("SCANNER_PROFILE_NOT_FOUND");
    }

    return {
      payload,
      organizerProfileId: profile.organizerProfileId,
      accessRole: Role.SCANNER,
      scannerProfileId: profile.id,
    };
  }

  if (payload.role === Role.ORGANIZER) {
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: payload.sub } });
    if (!profile) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    return {
      payload,
      organizerProfileId: profile.id,
      accessRole: Role.ORGANIZER,
      scannerProfileId: null,
    };
  }

  throw new Error("FORBIDDEN");
}
