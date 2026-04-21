
import { z } from "zod";
import { TicketClassType } from '@prisma/client';

const optionalTrimmedText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const sharedEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be 200 characters or fewer"),
  description: z.string().max(5000, "Description must be 5000 characters or fewer").optional(),
  categoryId: z.string().optional(),
  venueId: z.string().optional(),
  countryId: z.string().optional(),
  stateId: z.string().optional(),
  stateName: optionalTrimmedText,
  cityId: z.string().optional(),
  cityName: optionalTrimmedText,
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
  startAt: z.string().datetime("Invalid ISO datetime"),
  endAt: z.string().datetime("Invalid ISO datetime"),
  timezone: z.string().default("Pacific/Auckland"),
  currency: z.string().length(3).default('USD').optional(),
  commissionPct: z.coerce.number().min(0).max(100).default(10),
  gstPct: z.coerce.number().min(0).max(100).default(15),
  platformFeeFixed: z.coerce.number().min(0).default(0),
  tags: z.array(z.string().max(30)).max(10).default([]).optional(),
  audience: z.string().max(50).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  ticketClasses: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Ticket name is required"),
    price: z.coerce.number().min(0, "Price must be non-negative"),
    quantity: z.coerce.number().int().min(1, "Quantity must be a positive integer"),
    classType: z.nativeEnum(TicketClassType),
  })).min(1, "At least one ticket class is required"),
  layout: z.any().optional(),
});
