import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

const {
  getScannerAccessMock,
  getScopedEventMock,
  scannerAccessErrorResponseMock,
  eventFindManyMock,
  qrTicketFindManyMock,
  qrTicketCountMock,
  qrTicketUpdateManyMock,
  qrTicketFindUniqueMock,
  scannerDeviceFindManyMock,
  scannerDeviceUpsertMock,
  scannerDeviceFindUniqueMock,
  scannerDeviceUpdateMock,
  rateLimitRedisMock,
  writeAuditLogMock,
} = vi.hoisted(() => ({
  getScannerAccessMock: vi.fn(),
  getScopedEventMock: vi.fn(),
  scannerAccessErrorResponseMock: vi.fn(),
  eventFindManyMock: vi.fn(),
  qrTicketFindManyMock: vi.fn(),
  qrTicketCountMock: vi.fn(),
  qrTicketUpdateManyMock: vi.fn(),
  qrTicketFindUniqueMock: vi.fn(),
  scannerDeviceFindManyMock: vi.fn(),
  scannerDeviceUpsertMock: vi.fn(),
  scannerDeviceFindUniqueMock: vi.fn(),
  scannerDeviceUpdateMock: vi.fn(),
  rateLimitRedisMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/src/lib/scanner-access", () => ({
  getScannerAccess: getScannerAccessMock,
  getScopedEvent: getScopedEventMock,
  scannerAccessErrorResponse: scannerAccessErrorResponseMock,
}));

vi.mock("@/src/lib/http/rate-limit-redis", () => ({
  rateLimitRedis: rateLimitRedisMock,
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findMany: eventFindManyMock,
    },
    qRTicket: {
      findMany: qrTicketFindManyMock,
      count: qrTicketCountMock,
      updateMany: qrTicketUpdateManyMock,
      findUnique: qrTicketFindUniqueMock,
    },
    scannerDevice: {
      findMany: scannerDeviceFindManyMock,
      upsert: scannerDeviceUpsertMock,
      findUnique: scannerDeviceFindUniqueMock,
      update: scannerDeviceUpdateMock,
    },
  },
}));

import { GET as scannerEventsGet } from "@/app/api/scanner/events/route";
import { GET as scannerTicketsGet } from "@/app/api/scanner/events/[eventId]/tickets/route";
import { GET as scannerStateGet } from "@/app/api/scanner/events/[eventId]/state/route";
import { POST as batchCheckinPost } from "@/app/api/scanner/batch-checkin/route";
import { POST as registerDevicePost } from "@/app/api/scanner/devices/route";
import { PATCH as updateDevicePatch } from "@/app/api/scanner/devices/[deviceId]/route";

describe("scanner app api integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getScannerAccessMock.mockResolvedValue({
      payload: { sub: "scanner-user-1", role: Role.SCANNER },
      organizerProfileId: "org-1",
      accessRole: Role.SCANNER,
      scannerProfileId: "scanner-profile-1",
    });
    getScopedEventMock.mockResolvedValue({
      id: "event-1",
      title: "Launch Night",
      slug: "launch-night",
      startAt: new Date("2026-04-10T18:00:00.000Z"),
      endAt: new Date("2026-04-10T22:00:00.000Z"),
    });
    scannerAccessErrorResponseMock.mockReturnValue(null);
    rateLimitRedisMock.mockResolvedValue({ limited: false });
    writeAuditLogMock.mockResolvedValue(undefined);
    scannerDeviceFindManyMock.mockResolvedValue([]);
    scannerDeviceUpsertMock.mockResolvedValue({
      deviceId: "device-1",
      name: "Front Gate",
      userId: "scanner-user-1",
    });
    scannerDeviceFindUniqueMock.mockResolvedValue({
      deviceId: "device-1",
      userId: "scanner-user-1",
      user: {
        scannerProfile: {
          organizerProfileId: "org-1",
        },
      },
    });
    scannerDeviceUpdateMock.mockResolvedValue({
      deviceId: "device-1",
      name: "Main Entrance",
      userId: "scanner-user-1",
    });
  });

  it("returns scanner events for the authenticated organizer scope", async () => {
    eventFindManyMock.mockResolvedValue([
      {
        id: "event-1",
        title: "Launch Night",
        slug: "launch-night",
        startAt: new Date("2026-04-10T18:00:00.000Z"),
        endAt: new Date("2026-04-10T22:00:00.000Z"),
        venue: { name: "Town Hall" },
        orders: [
          {
            tickets: [
              { id: "ticket-1", checkedInAt: null, isCheckedIn: false },
              { id: "ticket-2", checkedInAt: new Date("2026-04-10T18:30:00.000Z"), isCheckedIn: true },
            ],
          },
        ],
      },
    ]);

    const req = new NextRequest("http://localhost/api/scanner/events");
    const res = await scannerEventsGet(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data).toEqual([
      expect.objectContaining({
        id: "event-1",
        totalTickets: 2,
        checkedInCount: 1,
      }),
    ]);
  });

  it("returns paginated scanner tickets with a cursor", async () => {
    qrTicketFindManyMock.mockResolvedValue([
      {
        id: "ticket-1",
        ticketNumber: "ORD-001",
        isCheckedIn: false,
        checkedInAt: null,
        checkedInDevice: null,
        order: { buyerName: "Alex" },
        orderItem: { ticketType: { name: "VIP" } },
      },
      {
        id: "ticket-2",
        ticketNumber: "ORD-002",
        isCheckedIn: true,
        checkedInAt: new Date("2026-04-10T18:30:00.000Z"),
        checkedInDevice: "device-1",
        order: { buyerName: "Jordan" },
        orderItem: { ticketType: { name: "General" } },
      },
    ]);
    qrTicketCountMock.mockResolvedValue(3);

    const req = new NextRequest("http://localhost/api/scanner/events/event-1/tickets?limit=2");
    const res = await scannerTicketsGet(req, { params: Promise.resolve({ eventId: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.total).toBe(3);
    expect(payload.data.nextCursor).toBe("ticket-2");
    expect(payload.data.tickets[0]).toEqual(
      expect.objectContaining({
        ticketTypeName: "VIP",
        holderName: "Alex",
      }),
    );
  });

  it("returns 403 when a scoped scanner event is outside the org", async () => {
    getScopedEventMock.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/scanner/events/event-1/tickets");
    const res = await scannerTicketsGet(req, { params: Promise.resolve({ eventId: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("processes batch check-ins with ok, duplicate, and not-found outcomes", async () => {
    qrTicketFindManyMock.mockResolvedValue([
      {
        id: "ticket-1",
        isCheckedIn: false,
        checkedInAt: null,
        checkedInDevice: null,
      },
      {
        id: "ticket-2",
        isCheckedIn: true,
        checkedInAt: new Date("2026-04-10T18:30:00.000Z"),
        checkedInDevice: "device-1",
      },
    ]);
    scannerDeviceFindManyMock.mockResolvedValue([{ deviceId: "device-1", name: "Front Gate" }]);
    qrTicketUpdateManyMock.mockResolvedValue({ count: 1 });

    const req = new NextRequest("http://localhost/api/scanner/batch-checkin", {
      method: "POST",
      body: JSON.stringify({
        eventId: "event-1",
        scans: [
          { ticketId: "ticket-1", scannedAt: "2026-04-10T18:31:00.000Z", deviceId: "device-1" },
          { ticketId: "ticket-2", scannedAt: "2026-04-10T18:32:00.000Z", deviceId: "device-1" },
          { ticketId: "missing-ticket", scannedAt: "2026-04-10T18:33:00.000Z" },
        ],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await batchCheckinPost(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.results).toEqual([
      expect.objectContaining({ ticketId: "ticket-1", outcome: "OK" }),
      expect.objectContaining({ ticketId: "ticket-2", outcome: "DUPLICATE", firstDeviceName: "Front Gate" }),
      expect.objectContaining({ ticketId: "missing-ticket", outcome: "NOT_FOUND" }),
    ]);
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
  });

  it("returns 403 for batch check-ins on an event outside the org", async () => {
    getScopedEventMock.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/scanner/batch-checkin", {
      method: "POST",
      body: JSON.stringify({ eventId: "event-2", scans: [] }),
      headers: { "content-type": "application/json" },
    });

    const res = await batchCheckinPost(req);
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("returns scanner state since a timestamp", async () => {
    qrTicketFindManyMock.mockResolvedValue([
      {
        id: "ticket-2",
        ticketNumber: "ORD-002",
        isCheckedIn: true,
        checkedInAt: new Date("2026-04-10T18:30:00.000Z"),
        checkedInDevice: "device-1",
      },
    ]);
    qrTicketCountMock.mockResolvedValue(7);
    scannerDeviceFindManyMock.mockResolvedValue([{ deviceId: "device-1", name: "Front Gate" }]);

    const req = new NextRequest("http://localhost/api/scanner/events/event-1/state?since=2026-04-10T18:00:00.000Z");
    const res = await scannerStateGet(req, { params: Promise.resolve({ eventId: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.totalCheckedIn).toBe(7);
    expect(payload.data.scans[0]).toEqual(
      expect.objectContaining({
        id: "ticket-2",
        deviceName: "Front Gate",
      }),
    );
  });

  it("registers scanner devices idempotently", async () => {
    const req = new NextRequest("http://localhost/api/scanner/devices", {
      method: "POST",
      body: JSON.stringify({ deviceId: "device-1", name: "Front Gate" }),
      headers: { "content-type": "application/json" },
    });

    const res = await registerDevicePost(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.data.deviceId).toBe("device-1");
    expect(scannerDeviceUpsertMock).toHaveBeenCalledWith({
      where: { deviceId: "device-1" },
      update: { name: "Front Gate" },
      create: {
        deviceId: "device-1",
        name: "Front Gate",
        userId: "scanner-user-1",
      },
    });
  });

  it("updates a scanner device name", async () => {
    const req = new NextRequest("http://localhost/api/scanner/devices/device-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Main Entrance" }),
      headers: { "content-type": "application/json" },
    });

    const res = await updateDevicePatch(req, { params: Promise.resolve({ deviceId: "device-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.name).toBe("Main Entrance");
    expect(scannerDeviceUpdateMock).toHaveBeenCalledWith({
      where: { deviceId: "device-1" },
      data: { name: "Main Entrance" },
    });
  });
});
