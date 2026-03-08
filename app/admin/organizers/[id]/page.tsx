"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type OrganizerDetail = {
  id: string;
  approvalStatus: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUSPENDED";
  companyName: string | null;
  brandName: string | null;
  website: string | null;
  taxId: string | null;
  contactName: string | null;
  phone: string | null;
  alternatePhone: string | null;
  supportEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  facebookPage: string | null;
  socialMediaLink: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  onboardingDoneAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    isActive: boolean;
  };
  payoutSettings: {
    payoutMode: "STRIPE_CONNECT" | "MANUAL";
    stripeAccountId: string | null;
    stripeOnboardingStatus: "NOT_STARTED" | "PENDING" | "COMPLETED";
    manualPayoutNote: string | null;
  } | null;
  venues: Array<{
    id: string;
    name: string;
    addressLine1: string;
    status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    totalSeats: number | null;
    totalTables: number | null;
    state: { name: string };
    city: { name: string };
  }>;
  state?: { id: string; name: string } | null;
  city?: { id: string; name: string } | null;
};

type OrganizerDraft = {
  companyName: string;
  brandName: string;
  website: string;
  taxId: string;
  contactName: string;
  phone: string;
  alternatePhone: string;
  supportEmail: string;
  addressLine1: string;
  addressLine2: string;
  facebookPage: string;
  socialMediaLink: string;
};

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

function statusBadgeClass(status: OrganizerDetail["approvalStatus"]) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "PENDING_APPROVAL") return "bg-amber-100 text-amber-700 border-transparent";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-transparent";
  if (status === "SUSPENDED") return "bg-orange-100 text-orange-700 border-transparent";
  return "bg-neutral-100 text-neutral-600 border-transparent";
}

function venueStatusBadgeClass(status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-transparent";
  return "bg-amber-100 text-amber-700 border-transparent";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function toDraft(row: OrganizerDetail): OrganizerDraft {
  return {
    companyName: row.companyName ?? "",
    brandName: row.brandName ?? "",
    website: row.website ?? "",
    taxId: row.taxId ?? "",
    contactName: row.contactName ?? "",
    phone: row.phone ?? "",
    alternatePhone: row.alternatePhone ?? "",
    supportEmail: row.supportEmail ?? "",
    addressLine1: row.addressLine1 ?? "",
    addressLine2: row.addressLine2 ?? "",
    facebookPage: row.facebookPage ?? "",
    socialMediaLink: row.socialMediaLink ?? "",
  };
}

export default function AdminOrganizerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const organizerId = params?.id;

  const [row, setRow] = useState<OrganizerDetail | null>(null);
  const [draft, setDraft] = useState<OrganizerDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [editing, setEditing] = useState({
    company: false,
    contact: false,
    address: false,
    social: false,
  });

  const titleLabel = useMemo(() => {
    if (!row) return "Organizer";
    return row.companyName || row.brandName || row.user.email;
  }, [row]);

  useEffect(() => {
    let active = true;
    if (!organizerId) return;

    fetch(`/api/admin/organizers/${organizerId}`)
      .then((res) =>
        res.json().then((payload) => ({ status: res.status, ok: res.ok, payload })),
      )
      .then(({ status, ok, payload }) => {
        if (!active) return;

        if (status === 404) {
          setNotFound(true);
          setRow(null);
          setDraft(null);
          return;
        }

        if (!ok) {
          toast.error(payload?.error?.message ?? "Unable to load organizer");
          setRow(null);
          setDraft(null);
          return;
        }

        setNotFound(false);
        setRow(payload.data as OrganizerDetail);
        setDraft(toDraft(payload.data as OrganizerDetail));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organizerId]);

  async function saveSection(section: "company" | "contact" | "address" | "social") {
    if (!draft || !organizerId) return;
    setSavingSection(section);

    const sectionPayload: Record<typeof section, Partial<OrganizerDraft>> = {
      company: {
        companyName: draft.companyName,
        brandName: draft.brandName,
        website: draft.website,
        taxId: draft.taxId,
      },
      contact: {
        contactName: draft.contactName,
        phone: draft.phone,
        alternatePhone: draft.alternatePhone,
        supportEmail: draft.supportEmail,
      },
      address: {
        addressLine1: draft.addressLine1,
        addressLine2: draft.addressLine2,
      },
      social: {
        facebookPage: draft.facebookPage,
        socialMediaLink: draft.socialMediaLink,
      },
    };

    const res = await fetch(`/api/admin/organizers/${organizerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sectionPayload[section]),
    });
    const payload = await res.json();
    setSavingSection(null);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to save organizer section");
      return;
    }

    toast.success("Organizer updated");
    setRow(payload.data as OrganizerDetail);
    setDraft(toDraft(payload.data as OrganizerDetail));
    setEditing((prev) => ({ ...prev, [section]: false }));
  }

  function cancelSection(section: "company" | "contact" | "address" | "social") {
    if (!row) return;
    setDraft(toDraft(row));
    setEditing((prev) => ({ ...prev, [section]: false }));
  }

  async function decide(action: "APPROVED" | "REJECTED" | "SUSPENDED") {
    if (!organizerId || deciding) return;
    const reason = action === "REJECTED" ? prompt("Rejection reason") ?? "Rejected by admin" : undefined;

    setDeciding(true);
    const res = await fetch(`/api/admin/organizers/${organizerId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const payload = await res.json();
    setDeciding(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Action failed");
      return;
    }

    toast.success(`Organizer ${action.toLowerCase()}`);
    const refresh = await fetch(`/api/admin/organizers/${organizerId}`);
    const refreshPayload = await refresh.json();
    if (refresh.status === 404) {
      router.replace("/admin/organizers");
      return;
    }
    if (!refresh.ok) {
      toast.error(refreshPayload?.error?.message ?? "Unable to refresh organizer");
      return;
    }
    setRow(refreshPayload.data as OrganizerDetail);
    setDraft(toDraft(refreshPayload.data as OrganizerDetail));
  }

  function setDraftField<K extends keyof OrganizerDraft>(key: K, value: OrganizerDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (notFound) {
    return (
      <SidebarLayout role="admin" title="Admin" items={nav}>
        <PageHeader title="Organizer Detail" subtitle="Organizer profile details and actions." />
        <EmptyState title="Organizer not found" subtitle="This organizer may have been removed or the ID is invalid." cta={{ label: "Back to Organizers", href: "/admin/organizers" }} />
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Organizer Detail" subtitle="Full organizer profile, payout state, venues, and timeline." />
      <Link href="/admin/organizers" className="inline-flex text-sm font-medium text-[var(--theme-accent)] hover:underline">
        ← Organizers
      </Link>

      {loading || !row || !draft ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-64 rounded-xl bg-neutral-100" />
              <div className="h-4 w-40 rounded-xl bg-neutral-100" />
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-48 rounded-xl bg-neutral-100" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-4 rounded-xl bg-neutral-100" />
                <div className="h-4 rounded-xl bg-neutral-100" />
                <div className="h-4 rounded-xl bg-neutral-100" />
                <div className="h-4 rounded-xl bg-neutral-100" />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">{titleLabel}</h2>
                <Badge className={statusBadgeClass(row.approvalStatus)}>{row.approvalStatus}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => decide("APPROVED")} disabled={deciding}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => decide("REJECTED")} disabled={deciding}>Reject</Button>
                <Button size="sm" variant="destructive" onClick={() => decide("SUSPENDED")} disabled={deciding}>Suspend</Button>
              </div>
            </div>
            {row.approvalStatus === "REJECTED" && row.rejectionReason ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Rejection reason: {row.rejectionReason}
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900">Account</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Email</p>
                <p className="text-sm font-medium text-neutral-900">{row.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Email Verified</p>
                <p className="text-sm font-medium text-neutral-900">{row.user.emailVerified ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Account Active</p>
                <p className="text-sm font-medium text-neutral-900">{row.user.isActive ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Organizer Profile ID</p>
                <p className="break-all text-sm font-medium text-neutral-900">{row.id}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-neutral-900">Company Profile</h3>
              {!editing.company ? (
                <Button size="sm" variant="outline" onClick={() => setEditing((prev) => ({ ...prev, company: true }))}>Edit</Button>
              ) : null}
            </div>
            {!editing.company ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-sm text-neutral-500">Company Name</p><p className="text-sm font-medium text-neutral-900">{row.companyName || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Brand Name</p><p className="text-sm font-medium text-neutral-900">{row.brandName || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Website</p><p className="text-sm font-medium text-neutral-900">{row.website || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Tax ID</p><p className="text-sm font-medium text-neutral-900">{row.taxId || "—"}</p></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={draft.companyName} onChange={(event) => setDraftField("companyName", event.target.value)} placeholder="Company Name" />
                  <Input value={draft.brandName} onChange={(event) => setDraftField("brandName", event.target.value)} placeholder="Brand Name" />
                  <Input value={draft.website} onChange={(event) => setDraftField("website", event.target.value)} placeholder="Website" />
                  <Input value={draft.taxId} onChange={(event) => setDraftField("taxId", event.target.value)} placeholder="Tax ID" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveSection("company")} disabled={savingSection === "company"}>{savingSection === "company" ? "Saving..." : "Save"}</Button>
                  <Button size="sm" variant="outline" onClick={() => cancelSection("company")}>Cancel</Button>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-neutral-900">Contact</h3>
              {!editing.contact ? (
                <Button size="sm" variant="outline" onClick={() => setEditing((prev) => ({ ...prev, contact: true }))}>Edit</Button>
              ) : null}
            </div>
            {!editing.contact ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-sm text-neutral-500">Contact Name</p><p className="text-sm font-medium text-neutral-900">{row.contactName || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Phone</p><p className="text-sm font-medium text-neutral-900">{row.phone || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Alternate Phone</p><p className="text-sm font-medium text-neutral-900">{row.alternatePhone || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Support Email</p><p className="text-sm font-medium text-neutral-900">{row.supportEmail || "—"}</p></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={draft.contactName} onChange={(event) => setDraftField("contactName", event.target.value)} placeholder="Contact Name" />
                  <Input value={draft.phone} onChange={(event) => setDraftField("phone", event.target.value)} placeholder="Phone" />
                  <Input value={draft.alternatePhone} onChange={(event) => setDraftField("alternatePhone", event.target.value)} placeholder="Alternate Phone" />
                  <Input value={draft.supportEmail} onChange={(event) => setDraftField("supportEmail", event.target.value)} placeholder="Support Email" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveSection("contact")} disabled={savingSection === "contact"}>{savingSection === "contact" ? "Saving..." : "Save"}</Button>
                  <Button size="sm" variant="outline" onClick={() => cancelSection("contact")}>Cancel</Button>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-neutral-900">Address</h3>
              {!editing.address ? (
                <Button size="sm" variant="outline" onClick={() => setEditing((prev) => ({ ...prev, address: true }))}>Edit</Button>
              ) : null}
            </div>
            {!editing.address ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-sm text-neutral-500">Address Line 1</p><p className="text-sm font-medium text-neutral-900">{row.addressLine1 || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Address Line 2</p><p className="text-sm font-medium text-neutral-900">{row.addressLine2 || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">State</p><p className="text-sm font-medium text-neutral-900">{row.state?.name || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">City</p><p className="text-sm font-medium text-neutral-900">{row.city?.name || "—"}</p></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={draft.addressLine1} onChange={(event) => setDraftField("addressLine1", event.target.value)} placeholder="Address Line 1" />
                  <Input value={draft.addressLine2} onChange={(event) => setDraftField("addressLine2", event.target.value)} placeholder="Address Line 2" />
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2 text-sm text-neutral-700">State: {row.state?.name || "—"}</div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2 text-sm text-neutral-700">City: {row.city?.name || "—"}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveSection("address")} disabled={savingSection === "address"}>{savingSection === "address" ? "Saving..." : "Save"}</Button>
                  <Button size="sm" variant="outline" onClick={() => cancelSection("address")}>Cancel</Button>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-neutral-900">Social</h3>
              {!editing.social ? (
                <Button size="sm" variant="outline" onClick={() => setEditing((prev) => ({ ...prev, social: true }))}>Edit</Button>
              ) : null}
            </div>
            {!editing.social ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-sm text-neutral-500">Facebook Page</p><p className="text-sm font-medium text-neutral-900">{row.facebookPage || "—"}</p></div>
                <div><p className="text-sm text-neutral-500">Social Media Link</p><p className="text-sm font-medium text-neutral-900">{row.socialMediaLink || "—"}</p></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={draft.facebookPage} onChange={(event) => setDraftField("facebookPage", event.target.value)} placeholder="Facebook Page" />
                  <Input value={draft.socialMediaLink} onChange={(event) => setDraftField("socialMediaLink", event.target.value)} placeholder="Social Media Link" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveSection("social")} disabled={savingSection === "social"}>{savingSection === "social" ? "Saving..." : "Save"}</Button>
                  <Button size="sm" variant="outline" onClick={() => cancelSection("social")}>Cancel</Button>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900">Payout</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="text-sm text-neutral-500">Payout Mode</p><p className="text-sm font-medium text-neutral-900">{row.payoutSettings?.payoutMode || "Not configured"}</p></div>
              <div><p className="text-sm text-neutral-500">Stripe Account ID</p><p className="break-all text-sm font-medium text-neutral-900">{row.payoutSettings?.stripeAccountId || "None"}</p></div>
              <div><p className="text-sm text-neutral-500">Stripe Onboarding</p><p className="text-sm font-medium text-neutral-900">{row.payoutSettings?.stripeOnboardingStatus || "Not configured"}</p></div>
              <div><p className="text-sm text-neutral-500">Manual Payout Note</p><p className="text-sm font-medium text-neutral-900">{row.payoutSettings?.manualPayoutNote || "—"}</p></div>
            </div>
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900">Venues</h3>
            {row.venues.length === 0 ? (
              <p className="text-sm text-neutral-600">No venues yet.</p>
            ) : (
              <div className="space-y-3">
                {row.venues.map((venue) => (
                  <div key={venue.id} className="rounded-xl border border-[var(--border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{venue.name}</p>
                        <p className="text-sm text-neutral-600">{venue.addressLine1}, {venue.city.name}, {venue.state.name}</p>
                      </div>
                      <Badge className={venueStatusBadgeClass(venue.status)}>{venue.status}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-700">
                      <span>Seats: {venue.totalSeats ?? 0}</span>
                      <span>Tables: {venue.totalTables ?? 0}</span>
                      <Link href="/admin/venues" className="font-medium text-[var(--theme-accent)] hover:underline">View Venue</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900">Timeline</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="text-sm text-neutral-500">Created At</p><p className="text-sm font-medium text-neutral-900">{formatDateTime(row.createdAt)}</p></div>
              <div><p className="text-sm text-neutral-500">Submitted At</p><p className="text-sm font-medium text-neutral-900">{formatDateTime(row.submittedAt)}</p></div>
              <div><p className="text-sm text-neutral-500">Onboarding Done At</p><p className="text-sm font-medium text-neutral-900">{formatDateTime(row.onboardingDoneAt)}</p></div>
              <div><p className="text-sm text-neutral-500">Approved At</p><p className="text-sm font-medium text-neutral-900">{formatDateTime(row.approvedAt)}</p></div>
            </div>
            {row.rejectionReason ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Rejection reason: {row.rejectionReason}
              </div>
            ) : null}
          </article>
        </section>
      )}
    </SidebarLayout>
  );
}
