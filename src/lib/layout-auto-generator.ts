import { TicketClassType } from "@prisma/client";
import type { TicketClass } from "@/src/components/organizer/ticket-classes-step";
import type { SeatingColumn, SeatingSection, VenueSeatingConfig, VenueSeatingMapType } from "@/src/types/venue-seating";
import { computeSeatingSummary } from "@/src/lib/validators/venue-seating";

const DEFAULT_SEATS_PER_TABLE = 8;
const DEFAULT_TABLE_COLUMNS = 3;
const DEFAULT_SEATS_PER_ROW = 10;

export type LayoutCapacityDemand = {
  assignedSeatDemand: number;
  tableSeatDemand: number;
  totalLayoutDemand: number;
};

export type LayoutAssignmentData = {
  assignments: Record<string, string>;
  autoAssignedTicketClassIds: string[];
};

function makeSectionId(ticketClass: TicketClass, suffix: string) {
  return `generated-${ticketClass.id}-${suffix}`;
}

function isCompatibleSection(ticketClass: TicketClass, section: Pick<SeatingSection, "mapType">) {
  if (ticketClass.classType === TicketClassType.TABLE) {
    return section.mapType === "table";
  }
  if (ticketClass.classType === TicketClassType.ASSIGNED_SEAT || ticketClass.classType === TicketClassType.SECTIONED_GA) {
    return section.mapType === "seats";
  }
  return false;
}

function getTableGrid(tableCount: number) {
  const columns = Math.min(DEFAULT_TABLE_COLUMNS, Math.max(1, tableCount));
  return {
    columns,
    rows: Math.max(1, Math.ceil(tableCount / columns)),
  };
}

function buildSeatColumns(quantity: number): SeatingColumn[] {
  const rows = Math.max(1, Math.ceil(quantity / DEFAULT_SEATS_PER_ROW));
  return [
    {
      index: 1,
      rows,
      seats: DEFAULT_SEATS_PER_ROW,
    },
  ];
}

export function getLayoutCapacityDemand(ticketClasses: TicketClass[] = []): LayoutCapacityDemand {
  return ticketClasses.reduce(
    (demand, ticketClass) => {
      if (ticketClass.classType === TicketClassType.ASSIGNED_SEAT || ticketClass.classType === TicketClassType.SECTIONED_GA) {
        demand.assignedSeatDemand += ticketClass.quantity;
      }
      if (ticketClass.classType === TicketClassType.TABLE) {
        demand.tableSeatDemand += ticketClass.quantity;
      }
      demand.totalLayoutDemand = demand.assignedSeatDemand + demand.tableSeatDemand;
      return demand;
    },
    { assignedSeatDemand: 0, tableSeatDemand: 0, totalLayoutDemand: 0 },
  );
}

export function getSectionCapacity(section: Pick<SeatingSection, "mapType" | "columns" | "tableConfig">) {
  if (section.mapType === "table" && section.tableConfig) {
    return section.tableConfig.rows * section.tableConfig.columns * section.tableConfig.seatsPerTable;
  }
  if (section.mapType === "seats" && section.columns) {
    return section.columns.reduce((sum, column) => sum + column.rows * column.seats, 0);
  }
  return 0;
}

export function getLayoutCapacityByType(sections: SeatingSection[] = []) {
  return sections.reduce(
    (capacity, section) => {
      const sectionCapacity = getSectionCapacity(section);
      if (section.mapType === "table") {
        capacity.tableSeatCapacity += sectionCapacity;
      } else {
        capacity.assignedSeatCapacity += sectionCapacity;
      }
      capacity.totalLayoutCapacity = capacity.assignedSeatCapacity + capacity.tableSeatCapacity;
      return capacity;
    },
    { assignedSeatCapacity: 0, tableSeatCapacity: 0, totalLayoutCapacity: 0 },
  );
}

export function generateInitialLayoutFromTicketClasses(ticketClasses: TicketClass[]): VenueSeatingConfig | null {
  const sections: SeatingSection[] = [];
  let rowStart = 0;

  for (const ticketClass of ticketClasses) {
    if (ticketClass.quantity <= 0) continue;

    if (ticketClass.classType === TicketClassType.TABLE) {
      const tableCount = Math.ceil(ticketClass.quantity / DEFAULT_SEATS_PER_TABLE);
      const tableGrid = getTableGrid(tableCount);
      sections.push({
        id: makeSectionId(ticketClass, "tables"),
        name: `${ticketClass.name} Tables`,
        mapType: "table",
        rowStart,
        maxRows: tableGrid.rows,
        tableConfig: {
          ...tableGrid,
          seatsPerTable: DEFAULT_SEATS_PER_TABLE,
        },
      });
      rowStart += tableGrid.rows;
      continue;
    }

    if (ticketClass.classType === TicketClassType.ASSIGNED_SEAT || ticketClass.classType === TicketClassType.SECTIONED_GA) {
      const columns = buildSeatColumns(ticketClass.quantity);
      const maxRows = Math.max(...columns.map((column) => column.rows));
      sections.push({
        id: makeSectionId(ticketClass, "seats"),
        name: `${ticketClass.name} Seating`,
        mapType: "seats",
        rowStart,
        maxRows,
        columns,
      });
      rowStart += maxRows;
    }
  }

  if (sections.length === 0) {
    return null;
  }

  const hasTables = sections.some((section) => section.mapType === "table");
  const hasSeats = sections.some((section) => section.mapType === "seats");
  const mapType: VenueSeatingMapType = hasTables && hasSeats ? "mixed" : hasTables ? "table" : "seats";

  return {
    mapType,
    sections,
    seatState: {},
    summary: computeSeatingSummary(sections),
    schemaVersion: 1,
  };
}

export function generateLayoutAssignments({
  ticketClasses,
  sections,
  existingAssignments = {},
  previousAutoAssignedTicketClassIds,
}: {
  ticketClasses: TicketClass[];
  sections: SeatingSection[];
  existingAssignments?: Record<string, string>;
  previousAutoAssignedTicketClassIds?: string[];
}): LayoutAssignmentData {
  const previousAutoAssigned = new Set(previousAutoAssignedTicketClassIds ?? []);
  const autoAssignedTicketClassIds: string[] = [];
  const assignments: Record<string, string> = {};

  for (const ticketClass of ticketClasses) {
    if (ticketClass.classType === TicketClassType.GENERAL_ADMISSION) {
      assignments[ticketClass.id] = "";
      continue;
    }

    const compatibleSections = sections.filter((section) => isCompatibleSection(ticketClass, section));
    if (compatibleSections.length === 0) {
      assignments[ticketClass.id] = "";
      continue;
    }

    const existingAssignment = existingAssignments[ticketClass.id];
    const existingSection = compatibleSections.find((section) => section.id === existingAssignment);
    const shouldPreserveExisting = existingSection && !previousAutoAssigned.has(ticketClass.id);

    if (shouldPreserveExisting) {
      assignments[ticketClass.id] = existingSection.id;
      continue;
    }

    const generatedSectionId = makeSectionId(ticketClass, ticketClass.classType === TicketClassType.TABLE ? "tables" : "seats");
    const generatedSection = compatibleSections.find((section) => section.id === generatedSectionId);
    const capacityFitSection = compatibleSections
      .filter((section) => getSectionCapacity(section) >= ticketClass.quantity)
      .sort((a, b) => getSectionCapacity(a) - getSectionCapacity(b))[0];
    const fallbackSection = compatibleSections[0];
    const selectedSection = generatedSection ?? capacityFitSection ?? fallbackSection;

    assignments[ticketClass.id] = selectedSection.id;
    autoAssignedTicketClassIds.push(ticketClass.id);
  }

  return {
    assignments,
    autoAssignedTicketClassIds,
  };
}
