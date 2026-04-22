import { z } from "zod";
import { eventDetailsSchema } from "../lib/validators/shared-event-schema";
import type { SeatState, VenueSeatingConfig } from "./venue-seating";

export type EventDetailsFormData = z.infer<typeof eventDetailsSchema>;
export type EventLocation = EventDetailsFormData["location"];
export type EventSchedule = EventDetailsFormData["schedule"];
export type EventOrganizer = EventDetailsFormData["organizer"];
export type EventMedia = EventDetailsFormData["media"];
export type EventPolicies = EventDetailsFormData["policies"];
export type EventVisibility = EventDetailsFormData["visibility"];



export type EventSeatingLayout = {
  seatingConfig: VenueSeatingConfig;
  seatState?: Record<string, SeatState>;
  summary: { totalSeats: number; totalTables: number; sectionCount: number };
};

export type RelationalSeatingSection = {
  id: string;
  key: string;
  name: string;
  sectionType: "ROWS" | "TABLES" | "SECTIONED_GA";
  capacity: number;
  sortOrder: number;
};

export type RelationalSeatingLayout = {
  id: string;
  eventId?: string;
  mode: "GA_ONLY" | "ROWS" | "TABLES" | "MIXED";
  source?: "CUSTOM" | "VENUE_TEMPLATE";
  sections: RelationalSeatingSection[];
};

export type EventTicketClass = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "general" | "assigned_seat" | "table";
};

export type TicketMapping = {
  ticketClassId: string;
  targetId: string;
};

export type EventDraftMeta = {
  lastCompletedStep: number;
  version: number;
  lastSaved: string;
  isPublished: boolean;
};

export type EventDraft = {
  details: Partial<EventDetailsFormData>;
  venueId?: string | null;
  ticketClasses: EventTicketClass[];
  seatingLayout: Partial<EventSeatingLayout>;
  ticketMappings: TicketMapping[];
  meta: EventDraftMeta;
};
