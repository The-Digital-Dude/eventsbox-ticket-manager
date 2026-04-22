"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/attendees", label: "Attendees" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

type PlatformSettingsForm = {
  platformName: string;
  supportEmail: string;
  timezone: string;
  defaultCurrency: string;
  defaultLocale: string;
  logoUrl: string;
  faviconUrl: string;
  brandColor: string;
  secondaryBrandColor: string;
  footerText: string;
  defaultEventApprovalRequired: boolean;
  defaultOrganizerApprovalRequired: boolean;
  autoPublishMode: "NEVER" | "APPROVED_ORGANIZERS";
  defaultCancellationPolicy: string;
  defaultCommissionType: "PERCENTAGE" | "FIXED" | "BOTH";
  defaultCommissionValue: string;
  defaultTaxRate: string;
  defaultFeeStrategy: "PASS_TO_BUYER" | "ABSORB";
  payoutModeDefault: "MANUAL" | "STRIPE_CONNECT" | "AUTO";
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  featuredEventLimit: string;
  publicSearchEnabled: boolean;
  searchIndexingEnabled: boolean;
  smtpFromName: string;
  smtpFromEmail: string;
  emailNotificationsEnabled: boolean;
  adminAlertsEnabled: boolean;
  organizerApprovalEmailEnabled: boolean;
  eventApprovalEmailEnabled: boolean;
};

const defaults: PlatformSettingsForm = {
  platformName: "EventsBox",
  supportEmail: "support@eventsbox.com",
  timezone: "UTC",
  defaultCurrency: "USD",
  defaultLocale: "en",
  logoUrl: "",
  faviconUrl: "",
  brandColor: "#000000",
  secondaryBrandColor: "#111827",
  footerText: "",
  defaultEventApprovalRequired: true,
  defaultOrganizerApprovalRequired: true,
  autoPublishMode: "NEVER",
  defaultCancellationPolicy: "",
  defaultCommissionType: "PERCENTAGE",
  defaultCommissionValue: "10",
  defaultTaxRate: "15",
  defaultFeeStrategy: "PASS_TO_BUYER",
  payoutModeDefault: "MANUAL",
  defaultMetaTitle: "",
  defaultMetaDescription: "",
  featuredEventLimit: "6",
  publicSearchEnabled: true,
  searchIndexingEnabled: true,
  smtpFromName: "EventsBox",
  smtpFromEmail: "noreply@eventsbox.com",
  emailNotificationsEnabled: true,
  adminAlertsEnabled: true,
  organizerApprovalEmailEnabled: true,
  eventApprovalEmailEnabled: true,
};

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--border)] text-[var(--theme-accent)]"
      />
    </label>
  );
}

export default function AdminConfigPage() {
  const [form, setForm] = useState<PlatformSettingsForm>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof PlatformSettingsForm>(key: K, value: PlatformSettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/config", { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Unable to load settings");
        }

        if (!active || !payload?.data) return;
        const data = payload.data;
        setForm({
          ...defaults,
          platformName: data.platformName ?? defaults.platformName,
          supportEmail: data.supportEmail ?? defaults.supportEmail,
          timezone: data.timezone ?? defaults.timezone,
          defaultCurrency: data.defaultCurrency ?? defaults.defaultCurrency,
          defaultLocale: data.defaultLocale ?? defaults.defaultLocale,
          logoUrl: data.logoUrl ?? "",
          faviconUrl: data.faviconUrl ?? "",
          brandColor: data.brandColor ?? defaults.brandColor,
          secondaryBrandColor: data.secondaryBrandColor ?? defaults.secondaryBrandColor,
          footerText: data.footerText ?? "",
          defaultEventApprovalRequired: data.defaultEventApprovalRequired ?? true,
          defaultOrganizerApprovalRequired: data.defaultOrganizerApprovalRequired ?? true,
          autoPublishMode: data.autoPublishMode ?? "NEVER",
          defaultCancellationPolicy: data.defaultCancellationPolicy ?? "",
          defaultCommissionType: data.defaultCommissionType ?? "PERCENTAGE",
          defaultCommissionValue: String(data.defaultCommissionValue ?? data.defaultCommissionPct ?? 10),
          defaultTaxRate: String(data.defaultTaxRate ?? data.defaultGstPct ?? 15),
          defaultFeeStrategy: data.defaultFeeStrategy ?? "PASS_TO_BUYER",
          payoutModeDefault: data.payoutModeDefault ?? "MANUAL",
          defaultMetaTitle: data.defaultMetaTitle ?? "",
          defaultMetaDescription: data.defaultMetaDescription ?? "",
          featuredEventLimit: String(data.featuredEventLimit ?? 6),
          publicSearchEnabled: data.publicSearchEnabled ?? true,
          searchIndexingEnabled: data.searchIndexingEnabled ?? true,
          smtpFromName: data.smtpFromName ?? defaults.smtpFromName,
          smtpFromEmail: data.smtpFromEmail ?? defaults.smtpFromEmail,
          emailNotificationsEnabled: data.emailNotificationsEnabled ?? true,
          adminAlertsEnabled: data.adminAlertsEnabled ?? true,
          organizerApprovalEmailEnabled: data.organizerApprovalEmailEnabled ?? true,
          eventApprovalEmailEnabled: data.eventApprovalEmailEnabled ?? true,
        });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load settings");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError("");

    const commissionValue = Number(form.defaultCommissionValue);
    const taxRate = Number(form.defaultTaxRate);
    const defaultCommissionPct = form.defaultCommissionType === "FIXED" ? 0 : commissionValue;

    try {
      const response = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          defaultCurrency: form.defaultCurrency.toUpperCase(),
          defaultCommissionValue: commissionValue,
          defaultTaxRate: taxRate,
          featuredEventLimit: Number(form.featuredEventLimit),
          defaultCommissionPct,
          defaultGstPct: taxRate,
          logoUrl: form.logoUrl.trim() || null,
          faviconUrl: form.faviconUrl.trim() || null,
          footerText: form.footerText.trim() || null,
          defaultCancellationPolicy: form.defaultCancellationPolicy.trim() || null,
          defaultMetaTitle: form.defaultMetaTitle.trim() || null,
          defaultMetaDescription: form.defaultMetaDescription.trim() || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.error?.message ?? "Unable to save settings";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("Platform settings saved");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save settings";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Platform Settings" subtitle="Manage platform defaults used across organizer, event, checkout, discovery, and communication flows." />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <SettingsSection title="General Settings">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform Name</Label>
                <Input value={form.platformName} onChange={(event) => update("platformName", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input type="email" value={form.supportEmail} onChange={(event) => update("supportEmail", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={form.timezone} onChange={(event) => update("timezone", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Input value={form.defaultCurrency} maxLength={3} onChange={(event) => update("defaultCurrency", event.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label>Default Locale</Label>
                <Input value={form.defaultLocale} onChange={(event) => update("defaultLocale", event.target.value)} />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Branding Settings">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={form.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Favicon URL</Label>
                <Input value={form.faviconUrl} onChange={(event) => update("faviconUrl", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Brand Color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-12 p-1" value={form.brandColor} onChange={(event) => update("brandColor", event.target.value)} />
                  <Input value={form.brandColor} onChange={(event) => update("brandColor", event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Brand Color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-12 p-1" value={form.secondaryBrandColor} onChange={(event) => update("secondaryBrandColor", event.target.value)} />
                  <Input value={form.secondaryBrandColor} onChange={(event) => update("secondaryBrandColor", event.target.value)} />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Footer Text</Label>
                <Input value={form.footerText} onChange={(event) => update("footerText", event.target.value)} />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Event Policy Settings">
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow label="Require organizer approval by default" checked={form.defaultOrganizerApprovalRequired} onChange={(checked) => update("defaultOrganizerApprovalRequired", checked)} />
              <ToggleRow label="Require event approval by default" checked={form.defaultEventApprovalRequired} onChange={(checked) => update("defaultEventApprovalRequired", checked)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Auto-publish Mode</Label>
                <select className="app-select" value={form.autoPublishMode} onChange={(event) => update("autoPublishMode", event.target.value as PlatformSettingsForm["autoPublishMode"])}>
                  <option value="NEVER">Never</option>
                  <option value="APPROVED_ORGANIZERS">Approved organizers</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Default Cancellation Policy Text</Label>
                <textarea
                  value={form.defaultCancellationPolicy}
                  onChange={(event) => update("defaultCancellationPolicy", event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Financial Settings">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Commission Type</Label>
                <select className="app-select" value={form.defaultCommissionType} onChange={(event) => update("defaultCommissionType", event.target.value as PlatformSettingsForm["defaultCommissionType"])}>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Commission Value</Label>
                <Input type="number" min="0" step="0.01" value={form.defaultCommissionValue} onChange={(event) => update("defaultCommissionValue", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Default Tax Rate %</Label>
                <Input type="number" min="0" max="100" step="0.01" value={form.defaultTaxRate} onChange={(event) => update("defaultTaxRate", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fee Strategy</Label>
                <select className="app-select" value={form.defaultFeeStrategy} onChange={(event) => update("defaultFeeStrategy", event.target.value as PlatformSettingsForm["defaultFeeStrategy"])}>
                  <option value="PASS_TO_BUYER">Pass to buyer</option>
                  <option value="ABSORB">Absorb</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Payout Default</Label>
                <select className="app-select" value={form.payoutModeDefault} onChange={(event) => update("payoutModeDefault", event.target.value as PlatformSettingsForm["payoutModeDefault"])}>
                  <option value="MANUAL">Manual</option>
                  <option value="STRIPE_CONNECT">Stripe Connect</option>
                  <option value="AUTO">Auto</option>
                </select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="SEO / Discovery Settings">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Meta Title</Label>
                <Input value={form.defaultMetaTitle} onChange={(event) => update("defaultMetaTitle", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Featured Event Limit</Label>
                <Input type="number" min="1" max="100" value={form.featuredEventLimit} onChange={(event) => update("featuredEventLimit", event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Default Meta Description</Label>
                <Input value={form.defaultMetaDescription} onChange={(event) => update("defaultMetaDescription", event.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow label="Public search enabled" checked={form.publicSearchEnabled} onChange={(checked) => update("publicSearchEnabled", checked)} />
              <ToggleRow label="Search indexing enabled" checked={form.searchIndexingEnabled} onChange={(checked) => update("searchIndexingEnabled", checked)} />
            </div>
          </SettingsSection>

          <SettingsSection title="Communication Settings">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email From Name</Label>
                <Input value={form.smtpFromName} onChange={(event) => update("smtpFromName", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email From Address</Label>
                <Input type="email" value={form.smtpFromEmail} onChange={(event) => update("smtpFromEmail", event.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow label="Email notifications enabled" checked={form.emailNotificationsEnabled} onChange={(checked) => update("emailNotificationsEnabled", checked)} />
              <ToggleRow label="Admin alerts enabled" checked={form.adminAlertsEnabled} onChange={(checked) => update("adminAlertsEnabled", checked)} />
              <ToggleRow label="Organizer approval emails enabled" checked={form.organizerApprovalEmailEnabled} onChange={(checked) => update("organizerApprovalEmailEnabled", checked)} />
              <ToggleRow label="Event approval emails enabled" checked={form.eventApprovalEmailEnabled} onChange={(checked) => update("eventApprovalEmailEnabled", checked)} />
            </div>
          </SettingsSection>

          <div className="sticky bottom-4 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Platform Settings"}
            </Button>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
