import { PayoutMode } from "@prisma/client";
import { z } from "zod";

export const organizerOnboardingSchema = z.object({
  companyName: z.string().min(2),
  phone: z.string().min(6),
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

export const venueRequestSchema = z.object({
  name: z.string().min(2),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  stateId: z.string().min(1),
  cityId: z.string().min(1),
  categoryId: z.string().optional(),
});
