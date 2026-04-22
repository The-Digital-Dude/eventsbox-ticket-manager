import { EventDraft, EventTicketClass, TicketMapping } from "../types/event-draft";
import { VenueSeatingConfig, SeatingSection, SeatingColumn, VenueSeatingMapType } from "../types/venue-seating";
import { eventDetailsSchema, publishableEventSchema } from "./validators/shared-event-schema";
import { z } from "zod";
import { computeSeatingSummary } from "./validators/venue-seating";

// ---[ Private Helpers ]---
const DEFAULT_SEATS_PER_TABLE = 8;
const DEFAULT_TABLE_COLUMNS = 3;
const DEFAULT_SEATS_PER_ROW = 10;

function makeSectionId(ticketClass: EventTicketClass, suffix: string) {
  return `generated-${ticketClass.id}-${suffix}`;
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

function isCompatibleSection(ticketClass: EventTicketClass, section: Pick<SeatingSection, "mapType">): boolean {
  if (ticketClass.type === "table") {
    return section.mapType === "table";
  }
  if (ticketClass.type === "assigned_seat") {
    return section.mapType === "seats";
  }
  return false;
}

export function getSectionCapacity(section: Pick<SeatingSection, "mapType" | "columns" | "tableConfig">): number {
  if (section.mapType === "table" && section.tableConfig) {
    return section.tableConfig.rows * section.tableConfig.columns * section.tableConfig.seatsPerTable;
  }
  if (section.mapType === "seats" && section.columns) {
    return section.columns.reduce((sum, column) => sum + column.rows * column.seats, 0);
  }
  return 0;
}

// ---[ 1. Layout & Mapping Engine ] ---

export type LayoutMode = 'none' | 'seating' | 'table' | 'mixed';
export type LayoutDecision = {
  mode: LayoutMode;
  requiresLayout: boolean;
};

export function deriveLayoutMode(ticketClasses: Pick<EventTicketClass, 'type'>[]): LayoutDecision {
  const types = new Set(ticketClasses.map(tc => tc.type));
  const hasSeating = types.has("assigned_seat");
  const hasTable = types.has("table");

  if (hasSeating && hasTable) {
    return { mode: 'mixed', requiresLayout: true };
  }
  if (hasTable) {
    return { mode: 'table', requiresLayout: true };
  }
  if (hasSeating) {
    return { mode: 'seating', requiresLayout: true };
  }
  return { mode: 'none', requiresLayout: false };
}

export function generateLayout(ticketClasses: EventTicketClass[]): VenueSeatingConfig | null {
  const sections: SeatingSection[] = [];
  let rowStart = 0;

  for (const ticketClass of ticketClasses) {
    if (ticketClass.quantity <= 0) continue;

    if (ticketClass.type === "table") {
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

    if (ticketClass.type === "assigned_seat") {
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

export function autoMap(ticketClasses: EventTicketClass[], layout: VenueSeatingConfig, existingMappings: TicketMapping[] = []): TicketMapping[] {
  const mappings: TicketMapping[] = [];
  const mappedSectionIds = new Set<string>();

  for (const ticketClass of ticketClasses) {
    if (ticketClass.type === "general") continue;

    const compatibleSections = (layout.sections ?? []).filter(s => isCompatibleSection(ticketClass, s));
    if (compatibleSections.length === 0) continue;

    const existingMapping = existingMappings.find(m => m.ticketClassId === ticketClass.id);
    if (existingMapping && compatibleSections.some(s => s.id === existingMapping.targetId)) {
      mappings.push(existingMapping);
      mappedSectionIds.add(existingMapping.targetId);
      continue;
    }

    const generatedSectionId = makeSectionId(ticketClass, ticketClass.type === "table" ? "tables" : "seats");
    const generatedSection = compatibleSections.find(s => s.id === generatedSectionId && !mappedSectionIds.has(s.id));
    if (generatedSection) {
      mappings.push({ ticketClassId: ticketClass.id, targetId: generatedSection.id });
      mappedSectionIds.add(generatedSection.id);
      continue;
    }

    const bestFitSection = compatibleSections
      .filter(s => !mappedSectionIds.has(s.id))
      .sort((a, b) => getSectionCapacity(a) - getSectionCapacity(b))
      .find(s => getSectionCapacity(s) >= ticketClass.quantity);
    
    if (bestFitSection) {
      mappings.push({ ticketClassId: ticketClass.id, targetId: bestFitSection.id });
      mappedSectionIds.add(bestFitSection.id);
      continue;
    }

    const fallbackSection = compatibleSections.find(s => !mappedSectionIds.has(s.id));
    if (fallbackSection) {
        mappings.push({ ticketClassId: ticketClass.id, targetId: fallbackSection.id });
        mappedSectionIds.add(fallbackSection.id);
    }
  }

  return mappings;
}


// ---[ 2. Workflow Engine ] ---

export function deriveNextStep(draft: EventDraft): number {
  const { lastCompletedStep } = draft.meta;
  const decision = deriveLayoutMode(draft.ticketClasses);

  let nextStep = lastCompletedStep + 1;
  if ((nextStep === 3 || nextStep === 4) && !decision.requiresLayout) {
    nextStep = 5; // Skip layout and mapping if not required
  }
  return Math.min(nextStep, 5);
}


// ---[ 3. Validation Engine ] ---

/**
 * Validates the entire event draft for submission.
 */
export function validateEvent(draft: EventDraft): z.ZodIssue[] {
    const eventData = {
        details: draft.details,
        ticketClasses: draft.ticketClasses,
        layout: draft.seatingLayout,
    };
    const result = publishableEventSchema.safeParse(eventData);
    return result.success ? [] : result.error.issues;
}

/**
 * Validates a single step of the event draft.
 */
export function validateStep(draft: EventDraft, step: number): z.ZodIssue[] {
    let schema;
    let dataToValidate;

    switch(step) {
        case 1: 
            schema = eventDetailsSchema;
            dataToValidate = draft.details;
            break;
        case 2: 
            schema = publishableEventSchema.pick({ ticketClasses: true });
            dataToValidate = { ticketClasses: draft.ticketClasses };
            break;
        default: 
            return []; // No validation for other steps yet
    }

    const result = schema.safeParse(dataToValidate);
    return result.success ? [] : result.error.issues;
}
