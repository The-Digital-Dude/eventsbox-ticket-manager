"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type StateRow = { id: string; name: string; cities: { id: string; name: string }[] };
type CategoryRow = { id: string; name: string };
type VenueRow = { id: string; name: string };

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone, setTimezone] = useState("Pacific/Auckland");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [cancelPolicy, setCancelPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [commissionPct, setCommissionPct] = useState("10");
  const [gstPct, setGstPct] = useState("15");
  const [platformFeeFixed, setPlatformFeeFixed] = useState("0");

  const cities = states.find((s) => s.id === stateId)?.cities ?? [];

  useEffect(() => {
    Promise.all([
      fetch("/api/public/locations").then((r) => r.json()),
      fetch("/api/public/categories").then((r) => r.json()),
      fetch("/api/organizer/venues").then((r) => r.json()),
    ]).then(([l, c, v]) => {
      setStates(l?.data ?? []);
      setCategories(c?.data ?? []);
      setVenues((v?.data ?? []).filter((venue: { status: string }) => venue.status === "APPROVED"));
    });
  }, []);

  async function submit() {
    if (!title.trim()) return toast.error("Event title is required");
    if (!startAt || !endAt) return toast.error("Start and end dates are required");
    if (new Date(endAt) <= new Date(startAt)) return toast.error("End date must be after start date");

    setSaving(true);
    const res = await fetch("/api/organizer/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description, categoryId: categoryId || undefined,
        venueId: venueId || undefined, stateId: stateId || undefined,
        cityId: cityId || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        timezone,
        heroImage: heroImage || undefined,
        contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined,
        cancelPolicy: cancelPolicy || undefined, refundPolicy: refundPolicy || undefined,
        commissionPct: Number(commissionPct), gstPct: Number(gstPct),
        platformFeeFixed: Number(platformFeeFixed),
      }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to create event");
    toast.success("Event created — now add ticket types");
    router.push(`/organizer/events/${payload.data.id}`);
  }

  async function uploadHero(file: File) {
    setUploadingHeroImage(true);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/organizer/uploads/event-image", {
      method: "POST",
      body: fd,
    });
    const payload = await res.json();
    setUploadingHeroImage(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to upload image");
    setHeroImage(payload.data.url);
    toast.success("Hero image uploaded");
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Create New Event" subtitle="Fill in the event details. You can add tickets on the next page." />

      <div className="space-y-6">
        {/* Basic Info */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Basic Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event Title <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer Music Festival 2026" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="h-32 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your event..."
                maxLength={5000}
              />
            </div>
            <div className="space-y-2">
              <Label>Hero Image</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void uploadHero(file);
                }}
              />
              <Input
                value={heroImage}
                onChange={(e) => setHeroImage(e.target.value)}
                placeholder="Or paste image URL"
              />
              {uploadingHeroImage && <p className="text-xs text-neutral-500">Uploading image...</p>}
              {heroImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt="Event hero preview" className="h-40 w-full rounded-xl object-cover" />
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="app-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Select category (optional)</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <select className="app-select" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                  <option value="">Select venue (optional)</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <select className="app-select" value={stateId} onChange={(e) => { setStateId(e.target.value); setCityId(""); }}>
                  <option value="">Select state (optional)</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <select className="app-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                  <option value="">Select city (optional)</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Schedule</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date & Time <span className="text-red-500">*</span></Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date & Time <span className="text-red-500">*</span></Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <select className="app-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="Pacific/Auckland">Pacific/Auckland (NZT)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </section>

        {/* Contact & Policies */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Contact & Policies</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="tickets@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+64 9 123 4567" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Cancellation Policy</Label>
              <textarea
                className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                value={cancelPolicy}
                onChange={(e) => setCancelPolicy(e.target.value)}
                placeholder="Describe your cancellation policy..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Refund Policy</Label>
              <textarea
                className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                value={refundPolicy}
                onChange={(e) => setRefundPolicy(e.target.value)}
                placeholder="Describe your refund policy..."
              />
            </div>
          </div>
        </section>

        {/* Fees */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Fee Configuration</h2>
          <p className="mb-4 text-sm text-neutral-600">These defaults come from platform config. Override per-event if needed.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Platform Commission (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>GST (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fixed Platform Fee ($)</Label>
              <Input type="number" min="0" step="0.01" value={platformFeeFixed} onChange={(e) => setPlatformFeeFixed(e.target.value)} />
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <Button onClick={submit} disabled={saving}>
            {saving ? "Creating..." : "Create Event & Add Tickets"}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
