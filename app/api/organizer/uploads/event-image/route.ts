import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import {
  EventImageUploadError,
  isEventImageUploadConfigured,
  uploadEventImage,
} from "@/src/lib/services/event-image-upload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, Role.ORGANIZER);

    if (!isEventImageUploadConfigured()) {
      return fail(503, { code: "UPLOAD_NOT_CONFIGURED", message: "Cloudinary upload is not configured" });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail(400, { code: "FILE_REQUIRED", message: "Upload file is required" });
    }

    const uploaded = await uploadEventImage(file);
    return ok(uploaded, 201);
  } catch (error) {
    if (error instanceof EventImageUploadError) {
      return fail(error.status, { code: error.code, message: error.message });
    }
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to upload image" });
  }
}
