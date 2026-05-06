import { Prisma, SeatInventoryStatus } from "@prisma/client";
import type { SeatState, SeatingSection as VenueSeatingSection, VenueSeatingConfig } from "@/src/types/venue-seating";
import { buildSeatId, buildTableSeatId, rowLabel } from "@/src/lib/venue-seating";

type SeatingTx = Prisma.TransactionClient;

const sectionColors = ["#2563eb", "#16a34a", "#f97316", "#9333ea", "#0891b2", "#dc2626"];

function isDeleted(seatState: Record<string, SeatState> | null | undefined, seatId: string) {
  return Boolean(seatState?.[seatId]?.deleted);
}

function tableCount(section: VenueSeatingSection) {
  if (!section.tableConfig) return 0;
  return section.tableConfig.columns * section.tableConfig.rows;
}

export async function copyVenueSeatingToEvent(
  tx: SeatingTx,
  input: {
    eventId: string;
    seatingConfig: VenueSeatingConfig | null | undefined;
    seatState?: Record<string, SeatState> | null;
  },
) {
  if (!input.seatingConfig?.sections?.length) {
    return { sections: 0, rows: 0, seats: 0, tableZones: 0 };
  }

  let sectionCount = 0;
  let rowCount = 0;
  let seatCount = 0;
  let tableZoneCount = 0;

  for (const [sectionIndex, venueSection] of input.seatingConfig.sections.entries()) {
    if (venueSection.mapType === "table" && venueSection.tableConfig) {
      const zoneSeats = tableCount(venueSection) * venueSection.tableConfig.seatsPerTable;
      if (zoneSeats > 0) {
        await tx.tableZone.create({
          data: {
            eventId: input.eventId,
            name: venueSection.name,
            seatsPerTable: venueSection.tableConfig.seatsPerTable,
            totalTables: tableCount(venueSection),
            price: new Prisma.Decimal(venueSection.price ?? 0),
            color: sectionColors[sectionIndex % sectionColors.length],
          },
        });
        tableZoneCount += 1;
      }
      continue;
    }

    if (venueSection.mapType !== "seats" || !venueSection.columns?.length) {
      continue;
    }

    const section = await tx.seatingSection.create({
      data: {
        eventId: input.eventId,
        name: venueSection.name,
        color: sectionColors[sectionIndex % sectionColors.length],
        sortOrder: sectionIndex,
      },
    });
    sectionCount += 1;

    const rowLabels = new Set<string>();
    for (const column of venueSection.columns) {
      for (let rowIdx = 0; rowIdx < column.rows; rowIdx += 1) {
        rowLabels.add(rowLabel(venueSection.rowStart + rowIdx + 1));
      }
    }

    const rowByLabel = new Map<string, string>();
    for (const [rowIndex, label] of [...rowLabels].entries()) {
      const row = await tx.seatingRow.create({
        data: {
          sectionId: section.id,
          label,
          sortOrder: rowIndex,
        },
      });
      rowByLabel.set(label, row.id);
      rowCount += 1;
    }

    const seats = venueSection.columns.flatMap((column, columnIndex) => {
      const offsetBefore = venueSection.columns
        ?.slice(0, columnIndex)
        .reduce((sum, entry) => sum + entry.seats, 0) ?? 0;

      return Array.from({ length: column.rows }).flatMap((_, rowIdx) => {
        const label = rowLabel(venueSection.rowStart + rowIdx + 1);
        const rowId = rowByLabel.get(label);
        if (!rowId) return [];

        return Array.from({ length: column.seats }).flatMap((__, seatIdx) => {
          const seatNo = offsetBefore + seatIdx + 1;
          const seatId = buildSeatId(venueSection, label, seatNo);
          if (isDeleted(input.seatState, seatId)) return [];

          return {
            eventId: input.eventId,
            sectionId: section.id,
            rowId,
            seatLabel: `${label}-${seatNo}`,
            status: SeatInventoryStatus.AVAILABLE,
          };
        });
      });
    });

    if (seats.length > 0) {
      await tx.seatInventory.createMany({ data: seats, skipDuplicates: true });
      seatCount += seats.length;
    }
  }

  return { sections: sectionCount, rows: rowCount, seats: seatCount, tableZones: tableZoneCount };
}

export function countVenueTemplateSeats(config: VenueSeatingConfig, seatState?: Record<string, SeatState> | null) {
  let seats = 0;
  let tableZones = 0;

  for (const section of config.sections) {
    if (section.mapType === "table" && section.tableConfig) {
      tableZones += tableCount(section);
      for (let tableIndex = 1; tableIndex <= tableCount(section); tableIndex += 1) {
        for (let seatIndex = 1; seatIndex <= section.tableConfig.seatsPerTable; seatIndex += 1) {
          if (!isDeleted(seatState, buildTableSeatId(section, tableIndex, seatIndex))) seats += 1;
        }
      }
      continue;
    }

    for (const [columnIndex, column] of (section.columns ?? []).entries()) {
      const offsetBefore = (section.columns ?? [])
        .slice(0, columnIndex)
        .reduce((sum, entry) => sum + entry.seats, 0);

      for (let rowIdx = 0; rowIdx < column.rows; rowIdx += 1) {
        const label = rowLabel(section.rowStart + rowIdx + 1);
        for (let seatIdx = 0; seatIdx < column.seats; seatIdx += 1) {
          const seatNo = offsetBefore + seatIdx + 1;
          if (!isDeleted(seatState, buildSeatId(section, label, seatNo))) seats += 1;
        }
      }
    }
  }

  return { seats, tableZones };
}
