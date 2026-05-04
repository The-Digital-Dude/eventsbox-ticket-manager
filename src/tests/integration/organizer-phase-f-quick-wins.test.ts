import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const {
  requireRoleMock,
  organizerProfileFindUniqueMock,
  eventFindFirstMock,
  eventCreateMock,
  ticketTypeFindFirstMock,
  ticketTypeCreateMock,
  ticketTypeUpdateMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  organizerProfileFindUniqueMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  eventCreateMock: vi.fn(),
  ticketTypeFindFirstMock: vi.fn(),
  ticketTypeCreateMock: vi.fn(),
  ticketTypeUpdateMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: organizerProfileFindUniqueMock,
    },
    event: {
      findFirst: eventFindFirstMock,
      create: eventCreateMock,
    },
    ticketType: {
      findFirst: ticketTypeFindFirstMock,
      create: ticketTypeCreateMock,
      update: ticketTypeUpdateMock,
    },
  },
}));

import { POST as duplicateEventPost } from "@/app/api/organizer/events/[id]/duplicate/route";
import { POST as duplicateTicketTypePost } from "@/app/api/organizer/events/[id]/ticket-types/[ticketTypeId]/duplicate/route";
import { PATCH as patchTicketType } from "@/app/api/organizer/events/[id]/ticket-types/[ticketTypeId]/route";

const sourceEvent = {
  id: "event-1",
  organizerProfileId: "org-profile-1",
  seriesId: null,
  title: "Spring Gala",
  tagline: "A bright night",
  description: "Original description",
  heroImage: "https://example.com/hero.jpg",
  images: ["https://example.com/one.jpg"],
  eventType: "PHYSICAL",
  onlineAccessLink: null,
  visibility: "PUBLIC",
  mode: "SIMPLE",
  categoryId: "category-1",
  venueId: "venue-1",
  countryId: "country-1",
  stateId: "state-1",
  cityId: "city-1",
  lat: 1,
  lng: 2,
  contactEmail: "organizer@example.com",
  contactPhone: "555-0100",
  cancelPolicy: "Cancel policy",
  refundPolicy: "Refund policy",
  cancellationDeadlineHours: 24,
  refundPercent: 50,
  customConfirmationMessage: "Thanks",
  startAt: new Date("2026-06-01T10:00:00.000Z"),
  endAt: new Date("2026-06-01T12:00:00.000Z"),
  timezone: "UTC",
  currency: "USD",
  commissionPct: new Prisma.Decimal(10),
  gstPct: new Prisma.Decimal(15),
  platformFeeFixed: new Prisma.Decimal(1),
  tags: ["music"],
  audience: "All",
  videoUrl: "https://example.com/video",
  draftStep: 3,
};

const sourceTicket = {
  id: "ticket-1",
  eventId: "event-1",
  sectionId: null,
  name: "General Admission",
  description: "Main ticket",
  kind: "DIRECT",
  price: new Prisma.Decimal(25),
  quantity: 100,
  manualSoldOutPreviousQuantity: null,
  sold: 10,
  manuallySoldOut: false,
  reservedQty: 2,
  compIssued: 1,
  saleStartAt: new Date("2026-05-01T00:00:00.000Z"),
  saleEndAt: new Date("2026-05-31T00:00:00.000Z"),
  maxPerOrder: 4,
  isActive: true,
  sortOrder: 3,
};

describe("organizer Phase F quick wins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    organizerProfileFindUniqueMock.mockResolvedValue({ id: "org-profile-1" });
  });

  it("duplicates an event without copying ticket types or orders", async () => {
    eventFindFirstMock.mockResolvedValue(sourceEvent);
    eventCreateMock.mockResolvedValue({
      id: "event-copy-1",
      title: "Copy of Spring Gala",
      slug: "copy-of-spring-gala-abc123",
      status: "DRAFT",
    });

    const response = await duplicateEventPost(
      new NextRequest("http://localhost/api/organizer/events/event-1/duplicate", { method: "POST" }),
      { params: Promise.resolve({ id: "event-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(eventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Copy of Spring Gala",
        status: "DRAFT",
        organizerProfileId: "org-profile-1",
        description: "Original description",
        draftStep: 0,
      }),
      select: { id: true, title: true, slug: true, status: true },
    });
    expect(eventCreateMock.mock.calls[0][0].data.ticketTypes).toBeUndefined();
    expect(payload.data).toMatchObject({ id: "event-copy-1", status: "DRAFT" });
  });

  it("duplicates ticket type fields with a copy suffix", async () => {
    eventFindFirstMock.mockResolvedValue({ id: "event-1", status: "DRAFT" });
    ticketTypeFindFirstMock.mockResolvedValue(sourceTicket);
    ticketTypeCreateMock.mockResolvedValue({ ...sourceTicket, id: "ticket-copy-1", name: "General Admission (Copy)" });

    const response = await duplicateTicketTypePost(
      new NextRequest("http://localhost/api/organizer/events/event-1/ticket-types/ticket-1/duplicate", { method: "POST" }),
      { params: Promise.resolve({ id: "event-1", ticketTypeId: "ticket-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(ticketTypeCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event-1",
        name: "General Admission (Copy)",
        price: sourceTicket.price,
        quantity: 100,
        sold: 0,
        reservedQty: 0,
        compIssued: 0,
        manuallySoldOut: false,
        manualSoldOutPreviousQuantity: null,
        maxPerOrder: 4,
        sortOrder: 4,
      }),
    });
    expect(payload.data.id).toBe("ticket-copy-1");
  });

  it("marks ticket types sold out by setting quantity to sold", async () => {
    eventFindFirstMock.mockResolvedValue({ id: "event-1", status: "DRAFT" });
    ticketTypeFindFirstMock.mockResolvedValue({ ...sourceTicket, sold: 10, reservedQty: 0, compIssued: 0 });
    ticketTypeUpdateMock.mockResolvedValue({ ...sourceTicket, quantity: 10, sold: 10, reservedQty: 0 });

    const response = await patchTicketType(
      new NextRequest("http://localhost/api/organizer/events/event-1/ticket-types/ticket-1", {
        method: "PATCH",
        body: JSON.stringify({ soldOut: true }),
      }),
      { params: Promise.resolve({ id: "event-1", ticketTypeId: "ticket-1" }) },
    );

    expect(response.status).toBe(200);
    expect(ticketTypeUpdateMock).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: expect.objectContaining({
        quantity: 10,
        reservedQty: 0,
        manuallySoldOut: true,
        manualSoldOutPreviousQuantity: 100,
      }),
    });
  });

  it("marks manually sold-out ticket types available by restoring previous quantity", async () => {
    eventFindFirstMock.mockResolvedValue({ id: "event-1", status: "DRAFT" });
    ticketTypeFindFirstMock.mockResolvedValue({
      ...sourceTicket,
      quantity: 10,
      sold: 10,
      reservedQty: 0,
      compIssued: 0,
      manuallySoldOut: true,
      manualSoldOutPreviousQuantity: 100,
    });
    ticketTypeUpdateMock.mockResolvedValue({
      ...sourceTicket,
      quantity: 100,
      sold: 10,
      reservedQty: 0,
      manuallySoldOut: false,
      manualSoldOutPreviousQuantity: null,
    });

    const response = await patchTicketType(
      new NextRequest("http://localhost/api/organizer/events/event-1/ticket-types/ticket-1", {
        method: "PATCH",
        body: JSON.stringify({ soldOut: false }),
      }),
      { params: Promise.resolve({ id: "event-1", ticketTypeId: "ticket-1" }) },
    );

    expect(response.status).toBe(200);
    expect(ticketTypeUpdateMock).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: expect.objectContaining({
        quantity: 100,
        manuallySoldOut: false,
        manualSoldOutPreviousQuantity: null,
        isActive: true,
      }),
    });
  });
});
