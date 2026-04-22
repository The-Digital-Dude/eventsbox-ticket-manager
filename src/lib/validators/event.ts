import { z } from "zod";
import {
  getTicketClassType,
  getTicketInventoryMode,
  ticketClassTypes,
  ticketInventoryModes,
} from "@/src/lib/ticket-classes";

export const eventCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional(),
  venueId: z.string().optional(),
  countryId: z.string().optional(),
  stateId: z.string().optional(),
  stateName: z.string().trim().min(1).optional(),
  cityId: z.string().optional(),
  cityName: z.string().trim().min(1).optional(),
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
  seatingLayout: z.object({
    id: z.string(),
    mode: z.enum(["GA_ONLY", "ROWS", "TABLES", "MIXED"]),
    sections: z.array(z.object({
        key: z.string(),
        name: z.string().min(1),
        sectionType: z.enum(["ROWS", "TABLES", "SECTIONED_GA"]),
        capacity: z.number().int().min(0),
        price: z.number().min(0),
        sortOrder: z.number().int(),
    })),
  }).optional(),
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

const ticketClassTypeSchema = z.enum(ticketClassTypes);
const ticketInventoryModeSchema = z.enum(ticketInventoryModes);

const ticketTypeShape = {
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  kind: z.enum(["DIRECT", "COMBO"]).default("DIRECT"),
  classType: ticketClassTypeSchema.optional(),
  inventoryMode: ticketInventoryModeSchema.optional(),
  sectionId: z.string().optional().nullable(),
  eventSeatingSectionId: z.string().cuid().optional().nullable(),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
  reservedQty: z.coerce.number().int().min(0).default(0),
  saleStartAt: z.string().datetime().optional(),
  saleEndAt: z.string().datetime().optional(),
  maxPerOrder: z.coerce.number().int().min(1).max(100).default(10),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
};

export const ticketTypeCreateSchema = z.object(ticketTypeShape).transform((data) => {
  const classType = data.classType ?? getTicketClassType(data.inventoryMode);
  return {
    ...data,
    classType,
    inventoryMode: data.inventoryMode ?? getTicketInventoryMode(classType),
  };
});

export const ticketTypeUpdateSchema = z.object({
  name: ticketTypeShape.name.optional(),
  description: ticketTypeShape.description.optional(),
  kind: ticketTypeShape.kind.optional(),
  classType: ticketClassTypeSchema.optional(),
  inventoryMode: ticketInventoryModeSchema.optional(),
  sectionId: ticketTypeShape.sectionId.optional(),
  eventSeatingSectionId: ticketTypeShape.eventSeatingSectionId.optional(),
  price: ticketTypeShape.price.optional(),
  quantity: ticketTypeShape.quantity.optional(),
  reservedQty: ticketTypeShape.reservedQty.optional(),
  saleStartAt: ticketTypeShape.saleStartAt.optional(),
  saleEndAt: ticketTypeShape.saleEndAt.optional(),
  maxPerOrder: ticketTypeShape.maxPerOrder.optional(),
  isActive: ticketTypeShape.isActive.optional(),
  sortOrder: ticketTypeShape.sortOrder.optional(),
}).transform((data) => {
  if (!data.classType && !data.inventoryMode) return data;

  const classType = data.classType ?? getTicketClassType(data.inventoryMode);
  return {
    ...data,
    classType,
    inventoryMode: data.inventoryMode ?? getTicketInventoryMode(classType),
  };
});

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
