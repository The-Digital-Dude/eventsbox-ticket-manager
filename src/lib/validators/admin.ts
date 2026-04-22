import {
  OrganizerApprovalStatus,
  PlatformAutoPublishMode,
  PlatformCommissionType,
  PlatformFeeStrategy,
  PayoutMode,
  PayoutRequestStatus,
  VenueStatus,
} from "@prisma/client";
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
  platformName: z.string().trim().min(1).max(120),
  supportEmail: z.string().trim().email(),
  timezone: z.string().trim().min(1).max(80),
  defaultCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  defaultLocale: z.string().trim().min(2).max(16),
  logoUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  faviconUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryBrandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  footerText: z.string().trim().max(500).optional().nullable(),
  defaultEventApprovalRequired: z.boolean(),
  defaultOrganizerApprovalRequired: z.boolean(),
  autoPublishMode: z.nativeEnum(PlatformAutoPublishMode),
  defaultCancellationPolicy: z.string().trim().max(2000).optional().nullable(),
  defaultCommissionType: z.nativeEnum(PlatformCommissionType),
  defaultCommissionValue: z.coerce.number().min(0).max(100000),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  defaultFeeStrategy: z.nativeEnum(PlatformFeeStrategy),
  smtpFromName: z.string().trim().min(1).max(120),
  smtpFromEmail: z.string().trim().email(),
  emailNotificationsEnabled: z.boolean(),
  adminAlertsEnabled: z.boolean(),
  organizerApprovalEmailEnabled: z.boolean(),
  eventApprovalEmailEnabled: z.boolean(),
  defaultMetaTitle: z.string().trim().max(120).optional().nullable(),
  defaultMetaDescription: z.string().trim().max(300).optional().nullable(),
  featuredEventLimit: z.coerce.number().int().min(1).max(100),
  publicSearchEnabled: z.boolean(),
  searchIndexingEnabled: z.boolean(),
  defaultCommissionPct: z.coerce.number().min(0).max(100),
  defaultGstPct: z.coerce.number().min(0).max(100),
  payoutModeDefault: z.nativeEnum(PayoutMode),
}).transform((data) => ({
  ...data,
  logoUrl: data.logoUrl || null,
  faviconUrl: data.faviconUrl || null,
  footerText: data.footerText || null,
  defaultCancellationPolicy: data.defaultCancellationPolicy || null,
  defaultMetaTitle: data.defaultMetaTitle || null,
  defaultMetaDescription: data.defaultMetaDescription || null,
}));

export const categorySchema = z.object({
  name: z.string().min(2),
  isActive: z.boolean().default(true),
});

export const countrySchema = z.object({
  code: z.string().length(2).toUpperCase(),
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
