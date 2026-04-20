import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

type EventSeatingSectionRef = {
  key: string;
  name?: string | null;
};

type ResolvableEventSeating = {
  seatingPlan?: {
    seatingConfig?: unknown;
    seatState?: unknown | null;
    sections?: EventSeatingSectionRef[] | null;
  } | null;
  venue?: {
    seatingConfig?: unknown | null;
    seatState?: unknown | null;
  } | null;
};

export type ResolvedEventSeating = {
  seatingConfig: VenueSeatingConfig | null;
  seatState: Record<string, SeatState> | null;
  sections: EventSeatingSectionRef[];
  source: "event" | "venue" | "none";
};

export function resolveEventSeating(event: ResolvableEventSeating): ResolvedEventSeating {
  const eventConfig = (event.seatingPlan?.seatingConfig as VenueSeatingConfig | null | undefined) ?? null;
  if (eventConfig) {
    return {
      seatingConfig: eventConfig,
      seatState: (event.seatingPlan?.seatState as Record<string, SeatState> | null | undefined) ?? null,
      sections: event.seatingPlan?.sections ?? [],
      source: "event",
    };
  }

  const venueConfig = (event.venue?.seatingConfig as VenueSeatingConfig | null | undefined) ?? null;
  if (venueConfig) {
    return {
      seatingConfig: venueConfig,
      seatState: (event.venue?.seatState as Record<string, SeatState> | null | undefined) ?? null,
      sections: [],
      source: "venue",
    };
  }

  return {
    seatingConfig: null,
    seatState: null,
    sections: [],
    source: "none",
  };
}

export function getTicketSeatingSectionKey(ticket: {
  sectionId?: string | null;
  eventSeatingSection?: EventSeatingSectionRef | null;
}) {
  return ticket.eventSeatingSection?.key ?? ticket.sectionId ?? null;
}
