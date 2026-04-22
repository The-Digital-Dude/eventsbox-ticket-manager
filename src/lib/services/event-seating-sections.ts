import { EventSeatingSectionType } from "@prisma/client";
import type { SeatingSection, VenueSeatingConfig } from "@/src/types/venue-seating";

export type EventSeatingSectionSummary = {
  key: string;
  name: string;
  sectionType: EventSeatingSectionType;
  capacity: number | null;
  sortOrder: number;
};

export function getEventSeatingSectionType(section: SeatingSection): EventSeatingSectionType {
  return section.mapType === "table" ? "TABLES" : "ROWS";
}

export function getEventSeatingSectionCapacity(section: SeatingSection) {
  if (section.mapType === "table") {
    return (section.tableConfig?.rows ?? 0) * (section.tableConfig?.columns ?? 0) * (section.tableConfig?.seatsPerTable ?? 1);
  }

  return (section.columns ?? []).reduce((sum, column) => sum + column.rows * column.seats, 0);
}

export function getEventSeatingSectionSummaries(seatingConfig: VenueSeatingConfig): EventSeatingSectionSummary[] {
  return seatingConfig.sections.map((section, index) => ({
    key: section.id,
    name: section.name,
    sectionType: getEventSeatingSectionType(section),
    capacity: getEventSeatingSectionCapacity(section),
    sortOrder: index,
  }));
}
