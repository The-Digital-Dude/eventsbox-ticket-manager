export type SeatingMapType = "seats" | "table";
export type VenueSeatingMapType = SeatingMapType | "mixed";

export type SeatingColumn = {
  index: number;
  rows: number;
  seats: number;
};

export type SeatingTableConfig = {
  columns: number;
  rows: number;
  seatsPerTable: number;
};

export type SeatingSection = {
  id: string;
  name: string;
  price: number;
  mapType: SeatingMapType;
  rowStart: number;
  maxRows: number;
  columns?: SeatingColumn[];
  tableConfig?: SeatingTableConfig;
};

export type SeatState = {
  deleted?: boolean;
  selected?: boolean;
  offset?: number;
};

export type PublicSeatBookingStatus = "AVAILABLE" | "RESERVED" | "BOOKED";

export type PublicSeatBookingState = {
  status: PublicSeatBookingStatus;
  seatLabel?: string | null;
  expiresAt?: string | null;
};

export type SeatAvailabilityStatus = "available" | "reserved" | "booked";

export type VenueSeatingConfig = {
  mapType: VenueSeatingMapType;
  sections: SeatingSection[];
  seatState?: Record<string, SeatState>;
  summary: {
    totalSeats: number;
    totalTables: number;
    sectionCount: number;
  };
  schemaVersion: 1;
};
