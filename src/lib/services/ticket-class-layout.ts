import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import {
  deriveEventLayoutDecision,
  getTicketClassType,
  type DerivedEventLayoutDecision,
  type TicketClassType,
} from "@/src/lib/ticket-classes";

type LegacyVenueSection = {
  id: string;
  mapType?: string | null;
};

const eventLayoutInclude = {
  ticketTypes: {
    select: {
      id: true,
      isActive: true,
      inventoryMode: true,
      quantity: true,
      eventSeatingSectionId: true,
      sold: true,
    },
  },
  venue: {
    select: {
      seatingConfig: true,
    },
  },
  seatingPlan: {
    select: {
      sections: {
        select: {
          id: true,
          sectionType: true,
          capacity: true,
        },
      },
    },
  },
} satisfies Prisma.EventInclude;

export async function getEventLayoutDecision(eventId: string): Promise<DerivedEventLayoutDecision> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      ticketTypes: {
        select: {
          isActive: true,
          inventoryMode: true,
        },
      },
    },
  });

  const activeClassTypes = (event?.ticketTypes ?? [])
    .filter((ticketClass) => ticketClass.isActive)
    .map((ticketClass) => getTicketClassType(ticketClass.inventoryMode));

  return deriveEventLayoutDecision(activeClassTypes);
}

export async function syncEventLayoutMode(eventId: string) {
  const decision = await getEventLayoutDecision(eventId);
  await prisma.event.update({
    where: { id: eventId },
    data: { seatingMode: decision.eventSeatingMode },
  });
  return decision;
}

export async function validateTicketClassLayoutMapping(input: {
  eventId: string;
  classType: TicketClassType;
  quantity?: number | null;
  excludeTicketTypeId?: string | null;
  sectionId?: string | null;
  eventSeatingSectionId?: string | null;
}) {
  const { eventId, classType, quantity, excludeTicketTypeId, sectionId, eventSeatingSectionId } = input;

  if (!sectionId && !eventSeatingSectionId) {
    return;
  }

  if (classType === "general") {
    throw new Error("GENERAL_CLASS_CANNOT_HAVE_LAYOUT_MAPPING");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventLayoutInclude,
  });

  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }

  if (eventSeatingSectionId) {
    const section = event.seatingPlan?.sections.find((candidate) => candidate.id === eventSeatingSectionId);

    if (!section) {
      throw new Error("EVENT_SECTION_NOT_FOUND");
    }

    const isValid =
      classType === "mixed" ||
      (classType === "seating" && section.sectionType === "ROWS") ||
      (classType === "table" && section.sectionType === "TABLES");

    if (!isValid) {
      if (classType === "seating") throw new Error("SEATING_CLASS_REQUIRES_SEATING_SECTION");
      if (classType === "table") throw new Error("TABLE_CLASS_REQUIRES_TABLE_SECTION");
    }

    if (typeof quantity === "number" && section.capacity !== null) {
      const usedCapacity = event.ticketTypes
        .filter((ticketType) => ticketType.id !== excludeTicketTypeId && ticketType.eventSeatingSectionId === eventSeatingSectionId)
        .reduce((sum, ticketType) => sum + ("quantity" in ticketType && typeof ticketType.quantity === "number" ? ticketType.quantity : 0), 0);

      if (usedCapacity + quantity > section.capacity) {
        throw new Error("SECTION_CAPACITY_EXCEEDED");
      }
    }
  }

  if (sectionId) {
    const legacySections = ((event.venue?.seatingConfig as { sections?: LegacyVenueSection[] } | null)?.sections ?? []);
    const section = legacySections.find((candidate) => candidate.id === sectionId);

    if (!section) {
      throw new Error("VENUE_SECTION_NOT_FOUND");
    }

    const mapType = section.mapType;
    const isValid =
      classType === "mixed" ||
      (classType === "seating" && mapType === "seats") ||
      (classType === "table" && mapType === "table");

    if (!isValid) {
      if (classType === "seating") throw new Error("SEATING_CLASS_REQUIRES_SEATING_SECTION");
      if (classType === "table") throw new Error("TABLE_CLASS_REQUIRES_TABLE_SECTION");
    }
  }
}

export async function validateTicketClassAssignments(input: {
  eventId: string;
  assignments: Array<{ ticketTypeId: string; eventSeatingSectionId: string | null }>;
}) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: {
      seatingPlan: {
        include: {
          sections: {
            select: {
              id: true,
              name: true,
              sectionType: true,
              capacity: true,
            },
          },
        },
      },
      ticketTypes: {
        select: {
          id: true,
          name: true,
          quantity: true,
          sold: true,
          inventoryMode: true,
          eventSeatingSectionId: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const sectionById = new Map((event.seatingPlan?.sections ?? []).map((section) => [section.id, section]));
  const ticketById = new Map(event.ticketTypes.map((ticketType) => [ticketType.id, ticketType]));
  const finalAssignments = new Map(
    event.ticketTypes.map((ticketType) => [ticketType.id, ticketType.eventSeatingSectionId ?? null]),
  );

  for (const assignment of input.assignments) {
    if (!ticketById.has(assignment.ticketTypeId)) {
      throw new Error("TICKET_CLASS_NOT_FOUND");
    }
    finalAssignments.set(assignment.ticketTypeId, assignment.eventSeatingSectionId);
  }

  for (const [ticketTypeId, sectionId] of finalAssignments.entries()) {
    const ticketType = ticketById.get(ticketTypeId);
    if (!ticketType) continue;

    // Once sales exist, remapping the class would change fulfillment semantics for inventory already sold.
    if (ticketType.sold > 0 && (ticketType.eventSeatingSectionId ?? null) !== sectionId) {
      throw new Error("MAPPING_LOCKED_AFTER_SALES");
    }

    const classType = getTicketClassType(ticketType.inventoryMode);
    if (!sectionId) {
      if (classType === "general") continue;
      continue;
    }

    const section = sectionById.get(sectionId);
    if (!section) {
      throw new Error("EVENT_SECTION_NOT_FOUND");
    }

    const isValid =
      classType === "mixed" ||
      (classType === "seating" && section.sectionType === "ROWS") ||
      (classType === "table" && section.sectionType === "TABLES");

    if (!isValid) {
      if (classType === "seating") throw new Error("SEATING_CLASS_REQUIRES_SEATING_SECTION");
      if (classType === "table") throw new Error("TABLE_CLASS_REQUIRES_TABLE_SECTION");
      if (classType === "general") throw new Error("GENERAL_CLASS_CANNOT_HAVE_LAYOUT_MAPPING");
    }
  }

  const usedBySection = new Map<string, number>();
  for (const [ticketTypeId, sectionId] of finalAssignments.entries()) {
    if (!sectionId) continue;
    const ticketType = ticketById.get(ticketTypeId);
    if (!ticketType) continue;
    usedBySection.set(sectionId, (usedBySection.get(sectionId) ?? 0) + ticketType.quantity);
  }

  for (const section of event.seatingPlan?.sections ?? []) {
    if (section.capacity === null) continue;
    const used = usedBySection.get(section.id) ?? 0;
    if (used > section.capacity) {
      throw new Error("SECTION_CAPACITY_EXCEEDED");
    }
  }

  return {
    event,
    assignments: Array.from(finalAssignments.entries()).map(([ticketTypeId, eventSeatingSectionId]) => ({
      ticketTypeId,
      eventSeatingSectionId,
    })),
  };
}
