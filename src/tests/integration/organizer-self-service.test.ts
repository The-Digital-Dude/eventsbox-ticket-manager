import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireApprovedOrganizerMock,
  requireRoleMock,
  writeAuditLogMock,
  organizerProfileFindUniqueMock,
  eventFindFirstMock,
  eventUpdateMock,
  orderFindManyMock,
} = vi.hoisted(() => ({
  requireApprovedOrganizerMock: vi.fn(),
  requireRoleMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  organizerProfileFindUniqueMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  eventUpdateMock: vi.fn(),
  orderFindManyMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireApprovedOrganizer: requireApprovedOrganizerMock,
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: organizerProfileFindUniqueMock,
    },
    event: {
      findFirst: eventFindFirstMock,
      update: eventUpdateMock,
    },
    order: {
      findMany: orderFindManyMock,
    },
    eventSeries: {
      findFirst: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { POST as publishPost } from "@/app/api/organizer/events/[id]/publish/route";
import { PATCH as patchEvent } from "@/app/api/organizer/events/[id]/route";
import { GET as exportOrdersGet } from "@/app/api/organizer/export/orders/route";

describe("organizer self service integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireApprovedOrganizerMock.mockResolvedValue({
      payload: { sub: "organizer-user-1", role: "ORGANIZER" },
      profile: { id: "org-profile-1" },
    });
    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    organizerProfileFindUniqueMock.mockResolvedValue({ id: "org-profile-1" });
    orderFindManyMock.mockResolvedValue([]);
    writeAuditLogMock.mockResolvedValue(undefined);
  });

  it("toggles a previously approved published event back to draft", async () => {
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      status: "PUBLISHED",
      publishedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    eventUpdateMock.mockResolvedValue({ status: "DRAFT" });

    const res = await publishPost(
      new NextRequest("http://localhost/api/organizer/events/event-1/publish", { method: "POST" }),
      { params: Promise.resolve({ id: "event-1" }) },
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.status).toBe("DRAFT");
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "EVENT_UNPUBLISHED", entityId: "event-1" }),
    );
  });

  it("fails publish when the event was never approved", async () => {
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      status: "DRAFT",
      publishedAt: null,
    });

    const res = await publishPost(
      new NextRequest("http://localhost/api/organizer/events/event-1/publish", { method: "POST" }),
      { params: Promise.resolve({ id: "event-1" }) },
    );
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("NOT_YET_APPROVED");
  });

  it("saves custom confirmation message through event patch", async () => {
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      organizerProfileId: "org-profile-1",
      status: "DRAFT",
      startAt: new Date("2026-04-01T10:00:00.000Z"),
      endAt: new Date("2026-04-01T12:00:00.000Z"),
      ticketTypes: [],
      category: null,
      venue: null,
      state: null,
      city: null,
      series: null,
      _count: { orders: 0, waitlist: 0 },
      orders: [],
      reviews: [],
    });
    eventUpdateMock.mockResolvedValue({
      id: "event-1",
      customConfirmationMessage: "Welcome aboard!",
      ticketTypes: [],
      category: null,
      venue: null,
      state: null,
      city: null,
      series: null,
      _count: { orders: 0, waitlist: 0 },
      orders: [],
      reviews: [],
      startAt: new Date("2026-04-01T10:00:00.000Z"),
      endAt: new Date("2026-04-01T12:00:00.000Z"),
    });

    const res = await patchEvent(
      new NextRequest("http://localhost/api/organizer/events/event-1", {
        method: "PATCH",
        body: JSON.stringify({ customConfirmationMessage: "Welcome aboard!" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "event-1" }) },
    );

    expect(res.status).toBe(200);
    expect(eventUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customConfirmationMessage: "Welcome aboard!",
        }),
      }),
    );
  });

  it("exports organizer orders as CSV", async () => {
    orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        buyerName: "Buyer One",
        buyerEmail: "buyer@example.com",
        total: 125,
        status: "PAID",
        paidAt: new Date("2026-03-19T08:00:00.000Z"),
        event: { title: "City Fest" },
        items: [{ ticketType: { name: "General Admission" } }],
      },
    ]);

    const res = await exportOrdersGet(
      new NextRequest("http://localhost/api/organizer/export/orders"),
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("Order ID,Event Title,Buyer Name,Buyer Email,Total,Status,Ticket Types,Paid At");
    expect(body).toContain("\"order-1\",\"City Fest\",\"Buyer One\",\"buyer@example.com\",\"125.00\",\"PAID\",\"General Admission\"");
  });
});
