import { z } from "zod";

export const eventCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional(),
  venueId: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  heroImage: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional(),
  cancelPolicy: z.string().max(2000).optional(),
  refundPolicy: z.string().max(2000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().default("Pacific/Auckland"),
  commissionPct: z.coerce.number().min(0).max(100).default(10),
  gstPct: z.coerce.number().min(0).max(100).default(15),
  platformFeeFixed: z.coerce.number().min(0).default(0),
});

export const eventUpdateSchema = eventCreateSchema.partial();

export const ticketTypeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  kind: z.enum(["DIRECT", "COMBO"]).default("DIRECT"),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
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
  items: z.array(z.object({
    ticketTypeId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(20),
  })).min(1),
});

export const eventDecisionSchema = z.object({
  action: z.enum(["PUBLISHED", "REJECTED"]),
  reason: z.string().max(1000).optional(),
});

export const organizerEventCancelSchema = z.object({
  acknowledgePaidOrders: z.boolean().optional().default(false),
});
