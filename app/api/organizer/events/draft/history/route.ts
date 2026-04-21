
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
      include: {
        draftHistory: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!profile) {
      return fail(404, { code: "NOT_FOUND", message: "Organizer profile not found" });
    }

    return ok(profile.draftHistory);
  } catch (error) {
    console.error("[GET /api/organizer/events/draft/history]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to retrieve draft history" });
  }
}
