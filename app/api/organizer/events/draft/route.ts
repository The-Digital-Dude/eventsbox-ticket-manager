import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    return fail(401, { message: "Unauthorized" });
  }

  try {
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        draftEvent: true,
      },
    });

    if (!profile || !profile.draftEvent) {
      return ok(200, { data: null });
    }

    return ok(200, { data: profile.draftEvent });
  } catch (error) {
    console.error("[GET /api/organizer/events/draft]", error);
    return fail(500, { message: "Failed to retrieve draft" });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    return fail(401, { message: "Unauthorized" });
  }

  const body = await req.json();

  try {
    await prisma.organizerProfile.update({
      where: { userId: session.user.id },
      data: {
        draftEvent: body,
      },
    });
    return ok(200, { message: "Draft saved successfully" });
  } catch (error) {
    console.error("[POST /api/organizer/events/draft]", error);
    return fail(500, { message: "Failed to save draft" });
  }
}
