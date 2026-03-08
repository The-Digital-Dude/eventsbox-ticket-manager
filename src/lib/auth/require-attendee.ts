import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { getServerSession } from "@/src/lib/auth/server-auth";

export async function requireAttendee(req?: NextRequest) {
  if (req) {
    const payload = await requireRole(req, Role.ATTENDEE);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error("UNAUTHENTICATED");
    return { user };
  }

  const session = await getServerSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.user.role !== "ATTENDEE") throw new Error("FORBIDDEN");
  return session;
}
