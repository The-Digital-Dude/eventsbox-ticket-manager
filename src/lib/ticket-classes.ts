export const ticketClassTypes = ["general", "seating", "table", "mixed"] as const;

export type TicketClassType = (typeof ticketClassTypes)[number];

export const ticketInventoryModes = [
  "GENERAL_ADMISSION",
  "ASSIGNED_SEAT",
  "TABLE",
  "SECTIONED_GA",
] as const;

export type TicketInventoryMode = (typeof ticketInventoryModes)[number];

export const ticketClassTypeToInventoryMode: Record<TicketClassType, TicketInventoryMode> = {
  general: "GENERAL_ADMISSION",
  seating: "ASSIGNED_SEAT",
  table: "TABLE",
  mixed: "SECTIONED_GA",
};

export const ticketInventoryModeToClassType: Record<TicketInventoryMode, TicketClassType> = {
  GENERAL_ADMISSION: "general",
  ASSIGNED_SEAT: "seating",
  TABLE: "table",
  SECTIONED_GA: "mixed",
};

export function getTicketClassType(value?: string | null): TicketClassType {
  if (!value) return "general";
  return ticketInventoryModeToClassType[value as TicketInventoryMode] ?? "general";
}

export function getTicketInventoryMode(value?: string | null): TicketInventoryMode {
  if (!value) return "GENERAL_ADMISSION";
  return ticketClassTypeToInventoryMode[value as TicketClassType] ?? "GENERAL_ADMISSION";
}

export function formatTicketClassTypeLabel(classType: TicketClassType) {
  switch (classType) {
    case "general":
      return "General";
    case "seating":
      return "Seating";
    case "table":
      return "Table";
    case "mixed":
      return "Mixed";
    default:
      return "General";
  }
}

export type DerivedLayoutType = "none" | "seating" | "table" | "mixed";
export type DerivedEventSeatingMode = "GA_ONLY" | "ROWS" | "TABLES" | "MIXED";

export type DerivedEventLayoutDecision = {
  layoutType: DerivedLayoutType;
  eventSeatingMode: DerivedEventSeatingMode;
  requiresLayout: boolean;
  requiresVenue: boolean;
  supportsSeating: boolean;
  supportsTables: boolean;
};

export function deriveEventLayoutDecision(classTypes: Array<TicketClassType | string | null | undefined>): DerivedEventLayoutDecision {
  const normalized = classTypes.map((classType) =>
    ticketClassTypes.includes(classType as TicketClassType) ? (classType as TicketClassType) : "general",
  );

  const hasSeating = normalized.includes("seating");
  const hasTable = normalized.includes("table");
  const hasMixed = normalized.includes("mixed");

  if (hasMixed || (hasSeating && hasTable)) {
    return {
      layoutType: "mixed",
      eventSeatingMode: "MIXED",
      requiresLayout: true,
      requiresVenue: true,
      supportsSeating: true,
      supportsTables: true,
    };
  }

  if (hasTable) {
    return {
      layoutType: "table",
      eventSeatingMode: "TABLES",
      requiresLayout: true,
      requiresVenue: true,
      supportsSeating: false,
      supportsTables: true,
    };
  }

  if (hasSeating) {
    return {
      layoutType: "seating",
      eventSeatingMode: "ROWS",
      requiresLayout: true,
      requiresVenue: true,
      supportsSeating: true,
      supportsTables: false,
    };
  }

  return {
    layoutType: "none",
    eventSeatingMode: "GA_ONLY",
    requiresLayout: false,
    requiresVenue: false,
    supportsSeating: false,
    supportsTables: false,
  };
}

export function deriveEventLayoutModeFromTicketClasses(classTypes: Array<TicketClassType | string | null | undefined>) {
  return deriveEventLayoutDecision(classTypes).eventSeatingMode;
}

export function serializeTicketClass<T extends { inventoryMode?: string | null; classType?: string | null }>(ticket: T) {
  const classType = getTicketClassType(ticket.inventoryMode ?? ticket.classType);
  return {
    ...ticket,
    classType,
  };
}

export function serializeTicketClasses<T extends { inventoryMode?: string | null; classType?: string | null }>(tickets: T[]) {
  return tickets.map((ticket) => serializeTicketClass(ticket));
}
