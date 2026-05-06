import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { copyVenueSeatingToEvent } from "@/src/lib/services/venue-seating-copy";
import type { VenueSeatingConfig } from "@/src/types/venue-seating";

function txMock() {
  let sectionIndex = 0;
  let rowIndex = 0;
  const tx = {
    seatingSection: {
      create: vi.fn(async () => ({ id: `section-${sectionIndex += 1}` })),
    },
    seatingRow: {
      create: vi.fn(async () => ({ id: `row-${rowIndex += 1}` })),
    },
    seatInventory: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    tableZone: {
      create: vi.fn(async () => ({ id: "zone-1" })),
    },
  };
  return tx as typeof tx & Prisma.TransactionClient;
}

describe("copyVenueSeatingToEvent", () => {
  it("copies venue row seating into event-owned sections, rows, and seats", async () => {
    const tx = txMock();
    const config: VenueSeatingConfig = {
      mapType: "seats",
      sections: [
        {
          id: "main",
          name: "Main",
          mapType: "seats",
          rowStart: 0,
          maxRows: 2,
          columns: [{ index: 1, rows: 2, seats: 3 }],
        },
      ],
      summary: { totalSeats: 6, totalTables: 0, sectionCount: 1 },
      schemaVersion: 1,
    };

    const result = await copyVenueSeatingToEvent(tx, {
      eventId: "event-1",
      seatingConfig: config,
      seatState: { "Main-A2": { deleted: true } },
    });

    expect(result).toEqual({ sections: 1, rows: 2, seats: 5, tableZones: 0 });
    expect(tx.seatingSection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: "event-1", name: "Main", sortOrder: 0 }),
    });
    expect(tx.seatInventory.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ seatLabel: "A-1" }),
        expect.objectContaining({ seatLabel: "B-3" }),
      ]),
      skipDuplicates: true,
    });
    const createManyMock = tx.seatInventory.createMany as unknown as { mock: { calls: Array<Array<{ data: unknown[] }>> } };
    const createManyCall = createManyMock.mock.calls[0]?.[0];
    expect(createManyCall?.data).toHaveLength(5);
  });

  it("copies venue table seating into event table zones", async () => {
    const tx = txMock();
    const config: VenueSeatingConfig = {
      mapType: "table",
      sections: [
        {
          id: "vip",
          name: "VIP Tables",
          price: 25,
          mapType: "table",
          rowStart: 0,
          maxRows: 2,
          tableConfig: { rows: 2, columns: 3, seatsPerTable: 8 },
        },
      ],
      summary: { totalSeats: 48, totalTables: 6, sectionCount: 1 },
      schemaVersion: 1,
    };

    const result = await copyVenueSeatingToEvent(tx, { eventId: "event-1", seatingConfig: config });

    expect(result).toEqual({ sections: 0, rows: 0, seats: 0, tableZones: 1 });
    expect(tx.tableZone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event-1",
        name: "VIP Tables",
        seatsPerTable: 8,
        totalTables: 6,
      }),
    });
  });
});
