import type {
  PublicSeatBookingState,
  SeatState,
  SeatingSection,
  VenueSeatingConfig,
} from "@/src/types/venue-seating";

export type SeatDescriptor = {
  seatId: string;
  seatLabel: string;
  sectionId: string;
  sectionName: string;
};

export function rowLabel(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index <= alphabet.length) {
    return alphabet[index - 1];
  }
  const first = Math.floor((index - 1) / alphabet.length) - 1;
  const second = (index - 1) % alphabet.length;
  return `${alphabet[first]}${alphabet[second]}`;
}

export function buildSeatId(section: SeatingSection, rowName: string, seatNo: number) {
  return `${section.name || section.id}-${rowName}${seatNo}`;
}

export function buildTableSeatId(section: SeatingSection, tableIndex: number, seatIndex: number) {
  return `${section.name || section.id}-T${tableIndex}-S${seatIndex}`;
}

export function listSeatDescriptors(
  config: VenueSeatingConfig,
  seatState?: Record<string, SeatState> | null,
) {
  const descriptors: SeatDescriptor[] = [];

  for (const section of config.sections) {
    if (section.mapType === "table" && section.tableConfig) {
      const tableCount = section.tableConfig.rows * section.tableConfig.columns;
      for (let tableIndex = 1; tableIndex <= tableCount; tableIndex += 1) {
        for (let seatIndex = 1; seatIndex <= section.tableConfig.seatsPerTable; seatIndex += 1) {
          const seatId = buildTableSeatId(section, tableIndex, seatIndex);
          if (seatState?.[seatId]?.deleted) continue;
          descriptors.push({
            seatId,
            seatLabel: `Table ${tableIndex} Seat ${seatIndex}`,
            sectionId: section.id,
            sectionName: section.name,
          });
        }
      }
      continue;
    }

    for (const [columnIndex, column] of (section.columns ?? []).entries()) {
      const offsetBefore = (section.columns ?? [])
        .slice(0, columnIndex)
        .reduce((sum, entry) => sum + entry.seats, 0);

      for (let rowIdx = 0; rowIdx < column.rows; rowIdx += 1) {
        const rLabel = rowLabel(section.rowStart + rowIdx + 1);
        for (let seatIdx = 0; seatIdx < column.seats; seatIdx += 1) {
          const seatNo = offsetBefore + seatIdx + 1;
          const seatId = buildSeatId(section, rLabel, seatNo);
          if (seatState?.[seatId]?.deleted) continue;
          descriptors.push({
            seatId,
            seatLabel: `${section.name} ${rLabel}${seatNo}`,
            sectionId: section.id,
            sectionName: section.name,
          });
        }
      }
    }
  }

  return descriptors;
}

export function getSeatDescriptorMap(
  config: VenueSeatingConfig,
  seatState?: Record<string, SeatState> | null,
) {
  return Object.fromEntries(
    listSeatDescriptors(config, seatState).map((descriptor) => [descriptor.seatId, descriptor]),
  );
}

export function sanitizePublicSeatState(seatState?: Record<string, SeatState> | null) {
  if (!seatState) return null;

  return Object.fromEntries(
    Object.entries(seatState).map(([seatId, state]) => [
      seatId,
      {
        deleted: state.deleted ?? false,
        offset: state.offset ?? 0,
      },
    ]),
  );
}

export function buildPublicSeatStatusMap(
  seatIds: string[],
  bookings: Array<{ seatId: string; status: "RESERVED" | "BOOKED"; seatLabel?: string | null; expiresAt?: Date | null }>,
) {
  const initial = Object.fromEntries(
    seatIds.map((seatId) => [
      seatId,
      { status: "AVAILABLE", seatLabel: seatId, expiresAt: null } as PublicSeatBookingState,
    ]),
  ) as Record<string, PublicSeatBookingState>;

  for (const booking of bookings) {
    initial[booking.seatId] = {
      status: booking.status,
      seatLabel: booking.seatLabel ?? booking.seatId,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
    };
  }

  return initial;
}
