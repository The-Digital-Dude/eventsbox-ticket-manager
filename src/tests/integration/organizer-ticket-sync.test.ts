import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const {
  requireRoleMock,
  organizerProfileFindUniqueMock,
  eventFindFirstMock,
  tableZoneFindManyMock,
  prismaTransactionMock,
  txTicketTypeFindFirstMock,
  txTicketTypeCreateMock,
  txTicketTypeUpdateMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  organizerProfileFindUniqueMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  tableZoneFindManyMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  txTicketTypeFindFirstMock: vi.fn(),
  txTicketTypeCreateMock: vi.fn(),
  txTicketTypeUpdateMock: vi.fn(),
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
    },
    tableZone: {
      findMany: tableZoneFindManyMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

import { POST as syncTicketsPost } from "@/app/api/organizer/events/[id]/tickets/sync/route";

const tableZone = {
  id: "table-zone-1",
  eventId: "event-1",
  name: "Balcony Tables",
  seatsPerTable: 4,
  totalTables: 12,
  price: new Prisma.Decimal(75),
  color: "#2563eb",
  createdAt: new Date("2026-05-04T00:00:00.000Z"),
  updatedAt: new Date("2026-05-04T00:00:00.000Z"),
};

function queueTicketSyncTransaction() {
  prismaTransactionMock.mockImplementationOnce(async (
    callback: (tx: {
      ticketType: {
        findFirst: typeof txTicketTypeFindFirstMock;
        create: typeof txTicketTypeCreateMock;
        update: typeof txTicketTypeUpdateMock;
      };
    }) => Promise<unknown>,
  ) =>
    callback({
      ticketType: {
        findFirst: txTicketTypeFindFirstMock,
        create: txTicketTypeCreateMock,
        update: txTicketTypeUpdateMock,
      },
    }),
  );
}

describe("organizer ticket sync integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    organizerProfileFindUniqueMock.mockResolvedValue({ id: "org-profile-1" });
    eventFindFirstMock.mockResolvedValue({ id: "event-1", mode: "RESERVED_SEATING" });
    tableZoneFindManyMock.mockResolvedValue([tableZone]);
  });

  it("creates generated ticket types for priced table zones", async () => {
    queueTicketSyncTransaction();
    txTicketTypeFindFirstMock.mockResolvedValue(null);
    txTicketTypeCreateMock.mockResolvedValue({
      id: "ticket-type-1",
      eventId: "event-1",
      sectionId: tableZone.id,
      name: tableZone.name,
      price: tableZone.price,
      quantity: tableZone.totalTables,
      isActive: true,
    });

    const res = await syncTicketsPost(
      new NextRequest("http://localhost/api/organizer/events/event-1/tickets/sync", { method: "POST" }),
      { params: Promise.resolve({ id: "event-1" }) },
    );
    expect(res).toBeDefined();
    if (!res) throw new Error("Expected ticket sync response");
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(txTicketTypeCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event-1",
        sectionId: tableZone.id,
        name: "Balcony Tables",
        price: tableZone.price,
        quantity: 12,
        isActive: true,
      }),
    });
    expect(payload.data.ticketTypes[0]).toMatchObject({
      action: "created",
      sourceType: "TABLE",
      sourceId: tableZone.id,
    });
  });

  it("updates existing generated ticket types linked to table zones", async () => {
    queueTicketSyncTransaction();
    txTicketTypeFindFirstMock.mockResolvedValue({ id: "ticket-type-1", eventId: "event-1", sectionId: tableZone.id });
    txTicketTypeUpdateMock.mockResolvedValue({
      id: "ticket-type-1",
      eventId: "event-1",
      sectionId: tableZone.id,
      name: tableZone.name,
      price: tableZone.price,
      quantity: tableZone.totalTables,
      isActive: true,
    });

    const res = await syncTicketsPost(
      new NextRequest("http://localhost/api/organizer/events/event-1/tickets/sync", { method: "POST" }),
      { params: Promise.resolve({ id: "event-1" }) },
    );
    expect(res).toBeDefined();
    if (!res) throw new Error("Expected ticket sync response");
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(txTicketTypeUpdateMock).toHaveBeenCalledWith({
      where: { id: "ticket-type-1" },
      data: expect.objectContaining({
        sectionId: tableZone.id,
        name: "Balcony Tables",
        price: tableZone.price,
        quantity: 12,
      }),
    });
    expect(payload.data.ticketTypes[0].action).toBe("updated");
  });

  it("rejects simple events", async () => {
    eventFindFirstMock.mockResolvedValue({ id: "event-1", mode: "SIMPLE" });

    const res = await syncTicketsPost(
      new NextRequest("http://localhost/api/organizer/events/event-1/tickets/sync", { method: "POST" }),
      { params: Promise.resolve({ id: "event-1" }) },
    );
    expect(res).toBeDefined();
    if (!res) throw new Error("Expected ticket sync response");
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_EVENT_MODE");
    expect(tableZoneFindManyMock).not.toHaveBeenCalled();
  });
});
