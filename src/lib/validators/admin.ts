import { OrganizerApprovalStatus, PayoutMode, PayoutRequestStatus, VenueStatus } from "@prisma/client";
import { z } from "zod";

export const organizerDecisionSchema = z.object({
  action: z.enum([OrganizerApprovalStatus.APPROVED, OrganizerApprovalStatus.REJECTED, OrganizerApprovalStatus.SUSPENDED]),
  reason: z.string().optional(),
});

export const venueDecisionSchema = z.object({
  action: z.enum([VenueStatus.APPROVED, VenueStatus.REJECTED]),
  reason: z.string().optional(),
});

export const configSchema = z.object({
  defaultCommissionPct: z.number().min(0).max(100),
  defaultGstPct: z.number().min(0).max(100),
  payoutModeDefault: z.enum(PayoutMode),
});

export const categorySchema = z.object({
  name: z.string().min(2),
  isActive: z.boolean().default(true),
});

export const stateSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
});

export const citySchema = z.object({
  stateId: z.string().min(1),
  name: z.string().min(2),
});

export const payoutDecisionSchema = z.object({
  action: z.enum([PayoutRequestStatus.APPROVED, PayoutRequestStatus.PAID, PayoutRequestStatus.REJECTED]),
  adminNote: z.string().max(500).optional(),
});

export const bulkEventActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(["APPROVE", "REJECT", "FEATURE", "UNFEATURE"]),
});
