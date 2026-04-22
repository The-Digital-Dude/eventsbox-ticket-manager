import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { fail, ok } from "@/src/lib/http/response";

export async function GET() {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  try {
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        draftEvent: true,
      },
    });

    if (!profile || !profile.draftEvent) {
      return ok({ data: null });
    }

    return ok({ data: profile.draftEvent });
  } catch (error) {
    console.error("[GET /api/organizer/events/draft]", error);
    return fail(500, { code: "INTERNAL_SERVER_ERROR", message: "Failed to retrieve draft" });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  const body = await req.json();

  // Handle case where the draft is being cleared
  if (body === null) {
    try {
      await prisma.organizerProfile.update({
        where: { userId: session.user.id },
        data: {
          draftEvent: Prisma.DbNull,
        },
      });
      return ok({ message: "Draft cleared successfully" });
    } catch (error) {
      console.error("[POST /api/organizer/events/draft] - Clear Draft", error);
      return fail(500, { code: "INTERNAL_SERVER_ERROR", message: "Failed to clear draft" });
    }
  }
  
  const { changeSummary, ...draftData } = body;

  try {
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "NOT_FOUND", message: "Organizer profile not found" });
    }

    await prisma.organizerProfile.update({
      where: { userId: session.user.id },
      data: {
        draftEvent: draftData as Prisma.InputJsonValue,
      },
    });

    try {
      const lastHistory = await prisma.draftHistory.findFirst({
        where: { organizerId: profile.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      await prisma.draftHistory.create({
        data: {
          organizerId: profile.id,
          version: (lastHistory?.version ?? 0) + 1,
          stepName: `Step ${draftData.meta?.lastCompletedStep ?? 1}`,
          changeSummary: changeSummary ?? "Draft saved",
          formData: draftData as Prisma.InputJsonValue,
        },
      });
    } catch (historyError) {
      console.warn("[POST /api/organizer/events/draft] Draft saved without history", historyError);
    }

    return ok({ message: "Draft saved successfully" });
  } catch (error) {
    console.error("[POST /api/organizer/events/draft]", error);
    return fail(500, { code: "INTERNAL_SERVER_ERROR", message: "Failed to save draft" });
  }
}
