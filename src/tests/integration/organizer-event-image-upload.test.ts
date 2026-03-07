import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  isConfiguredMock,
  uploadImageMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  isConfiguredMock: vi.fn(),
  uploadImageMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/event-image-upload", () => ({
  isEventImageUploadConfigured: isConfiguredMock,
  uploadEventImage: uploadImageMock,
  EventImageUploadError: class EventImageUploadError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 400) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

import { POST } from "@/app/api/organizer/uploads/event-image/route";

describe("organizer event image upload integration", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    isConfiguredMock.mockReset();
    uploadImageMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "org-1", role: "ORGANIZER" });
    isConfiguredMock.mockReturnValue(true);
    uploadImageMock.mockResolvedValue({
      url: "https://res.cloudinary.com/demo/image/upload/v1/eventsbox/events/a.png",
      publicId: "eventsbox/events/a",
      width: 1200,
      height: 600,
      bytes: 12345,
      format: "png",
    });
  });

  it("uploads image and returns 201", async () => {
    const form = new FormData();
    form.append("file", new File(["abc"], "cover.png", { type: "image/png" }));
    const req = new NextRequest("http://localhost/api/organizer/uploads/event-image", {
      method: "POST",
      body: form,
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.url).toContain("cloudinary");
    expect(uploadImageMock).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when upload is not configured", async () => {
    isConfiguredMock.mockReturnValueOnce(false);
    const req = new NextRequest("http://localhost/api/organizer/uploads/event-image", {
      method: "POST",
      body: new FormData(),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("UPLOAD_NOT_CONFIGURED");
  });

  it("returns 400 when file is missing", async () => {
    const req = new NextRequest("http://localhost/api/organizer/uploads/event-image", {
      method: "POST",
      body: new FormData(),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("FILE_REQUIRED");
  });
});
