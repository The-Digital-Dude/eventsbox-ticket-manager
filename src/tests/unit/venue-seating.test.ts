import { describe, expect, it } from "vitest";
import { computeSeatingSummary, venueSeatingConfigSchema } from "@/src/lib/validators/venue-seating";

describe("venue seating schema", () => {
  it("accepts valid mixed seating config", () => {
    const payload = {
      mapType: "table",
      sections: [
        {
          id: "s1",
          name: "VIP",
          mapType: "seats",
          rowStart: 0,
          maxRows: 3,
          columns: [
            { index: 1, rows: 3, seats: 4 },
            { index: 2, rows: 2, seats: 4 },
          ],
        },
        {
          id: "s2",
          name: "Tables",
          mapType: "table",
          rowStart: 3,
          maxRows: 2,
          tableConfig: { columns: 2, rows: 2, seatsPerTable: 8 },
        },
      ],
      seatState: { "VIP-A1": { selected: true } },
      summary: { totalSeats: 44, totalTables: 4, sectionCount: 2 },
      schemaVersion: 1,
    } as const;

    const result = venueSeatingConfigSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("computes summary correctly", () => {
    const summary = computeSeatingSummary([
      { mapType: "seats", columns: [{ seats: 10, rows: 2 }] },
      { mapType: "table", tableConfig: { columns: 3, rows: 2, seatsPerTable: 8 } },
    ]);

    expect(summary).toEqual({ totalSeats: 68, totalTables: 6, sectionCount: 2 });
  });

  it("rejects invalid oversized payload", () => {
    const result = venueSeatingConfigSchema.safeParse({
      mapType: "seats",
      sections: [
        {
          id: "s1",
          name: "Bad",
          mapType: "seats",
          rowStart: 0,
          maxRows: 1,
          columns: [{ index: 1, rows: 1, seats: 999 }],
        },
      ],
      summary: { totalSeats: 999, totalTables: 0, sectionCount: 1 },
      schemaVersion: 1,
    });

    expect(result.success).toBe(false);
  });
});
