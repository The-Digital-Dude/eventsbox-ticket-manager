import { z } from "zod";

export const eventCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional(),
  venueId: z.string().optional(),
  countryId: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  heroImage: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  images: z.array(z.string().url()).max(10).optional(),
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
});

export const eventUpdateSchema = eventCreateSchema.partial().extend({
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

export const checkoutIntentSchema = z.object({
  eventId: z.string().min(1),
  buyerName: z.string().min(2).max(200),
  buyerEmail: z.string().email(),
  promoCodeId: z.string().cuid().optional(),
  affiliateCode: z.string().optional(),
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

export const eventDecisionSchema = z.object({
  action: z.enum(["PUBLISHED", "REJECTED"]),
  reason: z.string().max(1000).optional(),
});

export const organizerEventCancelSchema = z.object({
  acknowledgePaidOrders: z.boolean().optional().default(false),
});
