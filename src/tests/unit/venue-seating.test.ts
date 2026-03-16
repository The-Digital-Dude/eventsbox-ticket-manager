import { describe, expect, it } from "vitest";
import { computeSeatingSummary, venueSeatingConfigSchema } from "@/src/lib/validators/venue-seating";
import { listSeatDescriptors } from "@/src/lib/venue-seating";
import type { PublicSeatBookingState, SeatingSection, VenueSeatingConfig } from "@/src/types/venue-seating";

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

// Helper that mirrors getSectionStats from EventDetailClient — isolates the
// per-section availability computation so it can be tested without a browser.
function getSectionStats(
  section: SeatingSection,
  fullConfig: VenueSeatingConfig,
  seatAvailability: Record<string, PublicSeatBookingState>,
) {
  const descriptors = listSeatDescriptors(
    { ...fullConfig, sections: [section] },
    fullConfig.seatState,
  );
  const total = descriptors.length;
  const booked = descriptors.filter((d) => seatAvailability[d.seatId]?.status === "BOOKED").length;
  const reserved = descriptors.filter((d) => seatAvailability[d.seatId]?.status === "RESERVED").length;
  const available = total - booked - reserved;
  return { total, booked, reserved, available };
}

describe("getSectionStats (Ticket Categories panel)", () => {
  const vipSection: SeatingSection = {
    id: "vip",
    name: "VIP",
    mapType: "seats",
    rowStart: 0,
    maxRows: 1,
    columns: [{ index: 1, rows: 1, seats: 3 }],
  };

  const generalSection: SeatingSection = {
    id: "gen",
    name: "General",
    mapType: "seats",
    rowStart: 0,
    maxRows: 1,
    columns: [{ index: 1, rows: 1, seats: 4 }],
  };

  const config: VenueSeatingConfig = {
    mapType: "seats",
    sections: [vipSection, generalSection],
    seatState: {},
    summary: { totalSeats: 7, totalTables: 0, sectionCount: 2 },
    schemaVersion: 1,
  };

  it("returns all seats available when no bookings exist", () => {
    const stats = getSectionStats(vipSection, config, {});
    expect(stats).toEqual({ total: 3, booked: 0, reserved: 0, available: 3 });
  });

  it("counts booked and reserved seats correctly", () => {
    const availability: Record<string, PublicSeatBookingState> = {
      "VIP-A1": { status: "BOOKED" },
      "VIP-A2": { status: "RESERVED" },
    };
    const stats = getSectionStats(vipSection, config, availability);
    expect(stats).toEqual({ total: 3, booked: 1, reserved: 1, available: 1 });
  });

  it("excludes deleted seats from the total", () => {
    const configWithDeleted: VenueSeatingConfig = {
      ...config,
      seatState: { "VIP-A3": { deleted: true } },
    };
    const stats = getSectionStats(vipSection, configWithDeleted, {});
    expect(stats).toEqual({ total: 2, booked: 0, reserved: 0, available: 2 });
  });

  it("only counts seats belonging to the given section", () => {
    const availability: Record<string, PublicSeatBookingState> = {
      "General-A1": { status: "BOOKED" },
      "General-A2": { status: "BOOKED" },
    };
    // VIP stats should not be affected by General bookings
    const vipStats = getSectionStats(vipSection, config, availability);
    expect(vipStats).toEqual({ total: 3, booked: 0, reserved: 0, available: 3 });

    // General stats should reflect its own bookings
    const genStats = getSectionStats(generalSection, config, availability);
    expect(genStats).toEqual({ total: 4, booked: 2, reserved: 0, available: 2 });
  });

  it("handles table-type sections", () => {
    const tableSection: SeatingSection = {
      id: "tables",
      name: "Tables",
      mapType: "table",
      rowStart: 0,
      maxRows: 1,
      tableConfig: { rows: 1, columns: 2, seatsPerTable: 4 },
    };
    const tableConfig: VenueSeatingConfig = {
      mapType: "table",
      sections: [tableSection],
      seatState: {},
      summary: { totalSeats: 8, totalTables: 2, sectionCount: 1 },
      schemaVersion: 1,
    };
    const availability: Record<string, PublicSeatBookingState> = {
      "Tables-T1-S1": { status: "BOOKED" },
      "Tables-T2-S1": { status: "RESERVED" },
    };
    const stats = getSectionStats(tableSection, tableConfig, availability);
    expect(stats).toEqual({ total: 8, booked: 1, reserved: 1, available: 6 });
  });
});
