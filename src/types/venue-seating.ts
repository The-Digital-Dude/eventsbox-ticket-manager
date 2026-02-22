export type SeatingMapType = "seats" | "table";

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
  price?: number | null;
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

export type VenueSeatingConfig = {
  mapType: SeatingMapType;
  sections: SeatingSection[];
  seatState?: Record<string, SeatState>;
  summary: {
    totalSeats: number;
    totalTables: number;
    sectionCount: number;
  };
  schemaVersion: 1;
};
