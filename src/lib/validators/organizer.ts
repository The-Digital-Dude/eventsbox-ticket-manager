import { PayoutMode } from "@prisma/client";
import { z } from "zod";
import { seatStateSchema, seatingSummarySchema, venueSeatingConfigSchema } from "@/src/lib/validators/venue-seating";

export const organizerOnboardingSchema = z.object({
  companyName: z.string().min(2),
  brandName: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().min(6),
  alternatePhone: z.string().optional(),
  supportEmail: z.string().optional(),
  facebookPage: z.string().optional(),
  twitterUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  socialMediaLink: z.string().optional(),
  contactName: z.string().min(2),
  taxId: z.string().optional(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  submit: z.boolean().default(false),
});

export const payoutSchema = z.object({
  payoutMode: z.enum(PayoutMode),
  manualPayoutNote: z.string().optional(),
});

export const payoutTestPaymentSchema = z.object({
  amount: z.coerce.number().positive().max(100000),
  description: z.string().trim().min(2).max(120),
  platformFeePct: z.coerce.number().min(0).max(100).optional(),
});

export const payoutRequestSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  note: z.string().max(500).optional(),
});

export const venueRequestSchema = z.object({
  name: z.string().min(2),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  countryId: z.string().optional(),
  stateId: z.string().min(1),
  cityId: z.string().min(1),
  categoryId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  seatingConfig: venueSeatingConfigSchema,
  seatState: seatStateSchema.optional(),
  summary: seatingSummarySchema,
});

export const venueUpdateSchema = z.object({
  seatingConfig: venueSeatingConfigSchema,
  seatState: seatStateSchema.optional(),
  summary: seatingSummarySchema,
});
