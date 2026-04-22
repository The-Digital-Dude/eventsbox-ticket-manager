import {
  PlatformAutoPublishMode,
  PlatformCommissionType,
  PlatformFeeStrategy,
  PayoutMode,
  type PlatformConfig,
} from "@prisma/client";
import { prisma } from "@/src/lib/db";

export const PLATFORM_CONFIG_ID = "singleton";

export type PlatformSettings = Omit<
  PlatformConfig,
  "defaultCommissionPct" | "defaultGstPct" | "defaultCommissionValue" | "defaultTaxRate"
> & {
  defaultCommissionPct: number;
  defaultGstPct: number;
  defaultCommissionValue: number;
  defaultTaxRate: number;
};

const fallbackPlatformSettings: PlatformSettings = {
  id: PLATFORM_CONFIG_ID,
  platformName: "EventsBox",
  supportEmail: "support@eventsbox.com",
  timezone: "UTC",
  defaultCurrency: "USD",
  defaultLocale: "en",
  logoUrl: null,
  faviconUrl: null,
  brandColor: "#000000",
  secondaryBrandColor: "#111827",
  footerText: null,
  defaultEventApprovalRequired: true,
  defaultOrganizerApprovalRequired: true,
  autoPublishMode: PlatformAutoPublishMode.NEVER,
  defaultCancellationPolicy: null,
  defaultCommissionType: PlatformCommissionType.PERCENTAGE,
  defaultCommissionValue: 10,
  defaultTaxRate: 15,
  defaultFeeStrategy: PlatformFeeStrategy.PASS_TO_BUYER,
  smtpFromName: "EventsBox",
  smtpFromEmail: "noreply@eventsbox.com",
  emailNotificationsEnabled: true,
  adminAlertsEnabled: true,
  organizerApprovalEmailEnabled: true,
  eventApprovalEmailEnabled: true,
  defaultMetaTitle: null,
  defaultMetaDescription: null,
  featuredEventLimit: 6,
  publicSearchEnabled: true,
  searchIndexingEnabled: true,
  defaultCommissionPct: 10,
  defaultGstPct: 15,
  payoutModeDefault: PayoutMode.MANUAL,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function serializeConfig(row: PlatformConfig): PlatformSettings {
  return {
    ...row,
    defaultCommissionPct: Number(row.defaultCommissionPct),
    defaultGstPct: Number(row.defaultGstPct),
    defaultCommissionValue: Number(row.defaultCommissionValue),
    defaultTaxRate: Number(row.defaultTaxRate),
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (!prisma.platformConfig) return fallbackPlatformSettings;

  try {
    const row = await prisma.platformConfig.findUnique({ where: { id: PLATFORM_CONFIG_ID } });
    return row ? serializeConfig(row) : fallbackPlatformSettings;
  } catch (error) {
    console.warn("[platform-settings] Falling back to default settings", error);
    return fallbackPlatformSettings;
  }
}

export async function getPlatformFinancialDefaults() {
  const settings = await getPlatformSettings();
  const commissionPct =
    settings.defaultCommissionType === PlatformCommissionType.FIXED
      ? 0
      : settings.defaultCommissionValue;
  const platformFeeFixed =
    settings.defaultCommissionType === PlatformCommissionType.PERCENTAGE
      ? 0
      : settings.defaultCommissionValue;

  return {
    currency: settings.defaultCurrency,
    commissionPct,
    gstPct: settings.defaultTaxRate,
    platformFeeFixed,
    feeStrategy: settings.defaultFeeStrategy,
    payoutModeDefault: settings.payoutModeDefault,
    defaultCancellationPolicy: settings.defaultCancellationPolicy,
  };
}

export async function shouldAutoApproveOrganizer() {
  const settings = await getPlatformSettings();
  return !settings.defaultOrganizerApprovalRequired;
}

export async function getEventApprovalDecision() {
  const settings = await getPlatformSettings();
  return {
    approvalRequired: settings.defaultEventApprovalRequired,
    autoPublishMode: settings.autoPublishMode,
  };
}

export async function getCommunicationSettings() {
  const settings = await getPlatformSettings();
  return {
    emailNotificationsEnabled: settings.emailNotificationsEnabled,
    adminAlertsEnabled: settings.adminAlertsEnabled,
    organizerApprovalEmailEnabled: settings.organizerApprovalEmailEnabled,
    eventApprovalEmailEnabled: settings.eventApprovalEmailEnabled,
    smtpFromName: settings.smtpFromName,
    smtpFromEmail: settings.smtpFromEmail,
  };
}
