import { z } from "zod";

const MAX_SECTIONS = 30;
const MAX_ROWS = 50;
const MAX_COLUMNS = 50;
const MAX_SEATS_PER_ROW = 100;
const MAX_SEATS_PER_TABLE = 20;

const seatingColumnSchema = z.object({
  index: z.number().int().min(1).max(MAX_COLUMNS),
  rows: z.number().int().min(1).max(MAX_ROWS),
  seats: z.number().int().min(1).max(MAX_SEATS_PER_ROW),
});

const seatingTableConfigSchema = z.object({
  columns: z.number().int().min(1).max(MAX_COLUMNS),
  rows: z.number().int().min(1).max(MAX_ROWS),
  seatsPerTable: z.number().int().min(2).max(MAX_SEATS_PER_TABLE),
});

const seatingSectionSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    price: z.number().min(0).nullable().optional(),
    mapType: z.enum(["seats", "table"]),
    rowStart: z.number().int().min(0),
    maxRows: z.number().int().min(1).max(MAX_ROWS),
    columns: z.array(seatingColumnSchema).max(MAX_COLUMNS).optional(),
    tableConfig: seatingTableConfigSchema.optional(),
  })
  .superRefine((section, ctx) => {
    if (section.mapType === "seats") {
      if (!section.columns || section.columns.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Seats section requires columns" });
      }
      if (section.tableConfig) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Seats section cannot contain tableConfig" });
      }
    }
    if (section.mapType === "table") {
      if (!section.tableConfig) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Table section requires tableConfig" });
      }
      if (section.columns && section.columns.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Table section cannot contain columns" });
      }
    }
  });

export const seatStateSchema = z.record(
  z
    .string()
    .min(1)
    .max(140)
    .regex(/^[\w\-:. ]+$/),
  z.object({
    deleted: z.boolean().optional(),
    selected: z.boolean().optional(),
    offset: z.number().min(-500).max(500).optional(),
  }),
);

export const seatingSummarySchema = z.object({
  totalSeats: z.number().int().min(0),
  totalTables: z.number().int().min(0),
  sectionCount: z.number().int().min(0).max(MAX_SECTIONS),
});

export const venueSeatingConfigSchema = z.object({
  mapType: z.enum(["seats", "table"]),
  sections: z.array(seatingSectionSchema).min(1).max(MAX_SECTIONS),
  seatState: seatStateSchema.optional(),
  summary: seatingSummarySchema,
  schemaVersion: z.literal(1),
});

export function computeSeatingSummary(
  sections: Array<{
    mapType: "seats" | "table";
    columns?: Array<{ seats: number; rows: number }>;
    tableConfig?: { columns: number; rows: number; seatsPerTable: number };
  }>,
) {
  let totalSeats = 0;
  let totalTables = 0;

  for (const section of sections) {
    if (section.mapType === "table" && section.tableConfig) {
      totalTables += section.tableConfig.columns * section.tableConfig.rows;
      totalSeats += section.tableConfig.columns * section.tableConfig.rows * section.tableConfig.seatsPerTable;
    }

    if (section.mapType === "seats" && section.columns) {
      totalSeats += section.columns.reduce((sum, column) => sum + column.seats * column.rows, 0);
    }
  }

  return {
    totalSeats,
    totalTables,
    sectionCount: sections.length,
  };
}
