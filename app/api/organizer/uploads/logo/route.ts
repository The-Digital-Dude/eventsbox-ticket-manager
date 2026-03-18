import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/guards";
import { prisma } from "@/src/lib/db";
import { uploadEventImage, EventImageUploadError } from "@/src/lib/services/event-image-upload";
import { ok, fail } from "@/src/lib/http/response";

export async function POST(req: NextRequest) {
  try {
    const payload = await requireRole(req, Role.ORGANIZER);
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return fail(400, { code: "MISSING_FILE", message: "No file provided" });
    }

    const { url } = await uploadEventImage(file);

    const profile = await prisma.organizerProfile.update({
      where: { userId: payload.sub },
      data: { logoUrl: url },
    });

    return ok({ logoUrl: profile.logoUrl });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Please log in" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Only organizers can upload logos" });
    }
    if (error instanceof EventImageUploadError) {
      return fail(error.status, { code: error.code, message: error.message });
    }
    console.error("Logo upload error:", error);
    return fail(500, { code: "INTERNAL_SERVER_ERROR", message: "Failed to upload logo" });
  }
}
