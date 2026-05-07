import { z } from "zod";

const oneTimeVenueSchema = z.object({
  name: z.string().trim().min(2).max(200),
  addressLine1: z.string().trim().min(3).max(300),
  addressLine2: z.string().trim().max(300).optional(),
  countryId: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  stateName: z.string().trim().min(1).max(120).optional(),
  cityName: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const eventBaseSchema = z.object({
  title: z.string().min(3).max(200),
  tagline: z.string().max(160).optional(),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional(),
  venueId: z.string().optional(),
  countryId: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  heroImage: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  images: z.array(z.string().url()).max(10).optional(),
  eventType: z.enum(["PHYSICAL", "ONLINE"]).default("PHYSICAL"),
  locationMode: z.enum(["ONE_TIME", "SAVED_VENUE"]).default("ONE_TIME").optional(),
  oneTimeVenue: oneTimeVenueSchema.optional(),
  onlineAccessLink: z.string().url().optional().or(z.literal("")),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).default("PUBLIC"),
  mode: z.enum(["SIMPLE", "RESERVED_SEATING"]).default("SIMPLE"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional(),
  cancelPolicy: z.string().max(2000).optional(),
  refundPolicy: z.string().max(2000).optional(),
  customConfirmationMessage: z.string().max(1000).optional().nullable(),
  cancellationDeadlineHours: z.coerce.number().int().min(1).nullable().optional(),
  refundPercent: z.coerce.number().int().refine((v) => [0, 50, 100].includes(v), {
    message: "refundPercent must be 0, 50, or 100",
  }).default(100),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().default("Pacific/Auckland"),
  currency: z.string().length(3).default('USD').optional(),
  commissionPct: z.coerce.number().min(0).max(100).default(10),
  gstPct: z.coerce.number().min(0).max(100).default(15),
  platformFeeFixed: z.coerce.number().min(0).default(0),
  tags: z.array(z.string().max(30)).max(10).default([]).optional(),
  audience: z.string().max(50).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  draftStep: z.coerce.number().int().min(0).max(4).default(0).optional(),
});

export const eventCreateSchema = eventBaseSchema.superRefine((event, ctx) => {
  if (event.eventType !== "PHYSICAL") return;

  if (event.locationMode === "SAVED_VENUE") {
    if (!event.venueId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["venueId"], message: "Select a saved venue" });
    }
    return;
  }

  if (!event.oneTimeVenue) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["oneTimeVenue"], message: "One-time venue details are required" });
    return;
  }

  if (!event.oneTimeVenue.stateId && !event.oneTimeVenue.stateName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["oneTimeVenue", "stateName"], message: "State is required" });
  }
  if (!event.oneTimeVenue.cityId && !event.oneTimeVenue.cityName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["oneTimeVenue", "cityName"], message: "City is required" });
  }
});

export const eventUpdateSchema = eventBaseSchema.partial().extend({
  seriesId: z.string().cuid().nullable().optional(),
});

export const eventSeriesSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  recurrenceType: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).nullable().optional(),
  recurrenceDaysOfWeek: z.array(z.number().min(0).max(6)).default([]).optional(),
  recurrenceEndDate: z.string().datetime().nullable().optional(),
});

export const ticketTypeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  kind: z.enum(["DIRECT", "COMBO"]).default("DIRECT"),
  sectionId: z.string().optional().nullable(),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
  reservedQty: z.coerce.number().int().min(0).default(0),
  saleStartAt: z.string().datetime().optional(),
  saleEndAt: z.string().datetime().optional(),
  maxPerOrder: z.coerce.number().int().min(1).max(100).default(10),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const ticketTypeUpdateSchema = ticketTypeCreateSchema.partial();
export const ticketTypePatchSchema = ticketTypeUpdateSchema.extend({
  soldOut: z.boolean().optional(),
});

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a valid hex color");

export const seatingPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createSection"),
    name: z.string().trim().min(1).max(100),
    price: z.coerce.number().min(0).optional().nullable(),
    color: colorSchema.default("#2563eb"),
    sortOrder: z.coerce.number().int().min(0).default(0),
  }),
  z.object({
    action: z.literal("createRow"),
    sectionId: z.string().min(1),
    label: z.string().trim().min(1).max(20),
    sortOrder: z.coerce.number().int().min(0).default(0),
  }),
  z.object({
    action: z.literal("createTableZone"),
    name: z.string().trim().min(1).max(100),
    seatsPerTable: z.coerce.number().int().min(1).max(100),
    totalTables: z.coerce.number().int().min(1).max(500),
    price: z.coerce.number().min(0),
    color: colorSchema.optional().nullable(),
  }),
  z.object({
    action: z.literal("bulkSeats"),
    sectionId: z.string().min(1),
    rowId: z.string().min(1).optional().nullable(),
    rowCount: z.coerce.number().int().min(1).max(100),
    seatsPerRow: z.coerce.number().int().min(1).max(250),
    rowPrefix: z.string().trim().max(8).default(""),
  }),
]);

export const seatingPatchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SECTION"),
    name: z.string().trim().min(1).max(100).optional(),
    price: z.coerce.number().min(0).optional().nullable(),
    color: colorSchema.optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("ROW"),
    label: z.string().trim().min(1).max(20).optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("TABLE_ZONE"),
    name: z.string().trim().min(1).max(100).optional(),
    seatsPerTable: z.coerce.number().int().min(1).max(100).optional(),
    totalTables: z.coerce.number().int().min(1).max(500).optional(),
    price: z.coerce.number().min(0).optional(),
    color: colorSchema.optional().nullable(),
  }),
  z.object({
    type: z.literal("SEAT"),
    status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "BLOCKED"]),
  }),
]);

export const seatingDeleteSchema = z.object({
  type: z.enum(["SECTION", "ROW", "TABLE_ZONE", "SEAT"]),
});

export const checkoutIntentSchema = z.object({
  eventId: z.string().min(1),
  buyerName: z.string().min(2).max(200),
  buyerEmail: z.string().email(),
  promoCodeId: z.string().cuid().optional(),
  affiliateCode: z.string().optional(),
  reservationToken: z.string().min(1).max(2000).optional(),
  selectedSeatIds: z.array(z.string().min(1).max(140)).max(50).optional(),
  items: z.array(z.object({
    ticketTypeId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(20),
  })).min(1),
  addOns: z.array(z.object({
    addOnId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
  })).optional().default([]),
  isWalkIn: z.boolean().optional().default(false),
  scannerId: z.string().optional(),
});

export const publicSeatReservationSchema = z.object({
  seatIds: z.array(z.string().min(1).max(140)).min(1).max(50),
});

export const eventDecisionSchema = z.object({
  action: z.enum(["PUBLISHED", "REJECTED", "REQUEST_CHANGES"]),
  reason: z.string().max(1000).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});

export const organizerEventCancelSchema = z.object({
  acknowledgePaidOrders: z.boolean().optional().default(false),
});
