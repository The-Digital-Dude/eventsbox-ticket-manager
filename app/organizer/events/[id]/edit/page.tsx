"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import Link from "next/link";

type StateRow = { id: string; name: string; cities: { id: string; name: string }[] };
type CategoryRow = { id: string; name: string };
type VenueRow = { id: string; name: string; status: string };

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

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);

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

  function toLocalDatetime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  useEffect(() => {
    async function load() {
      const [locRes, catRes, venRes, evRes] = await Promise.all([
        fetch("/api/public/locations").then((r) => r.json()),
        fetch("/api/public/categories").then((r) => r.json()),
        fetch("/api/organizer/venues").then((r) => r.json()),
        fetch(`/api/organizer/events/${id}`).then((r) => r.json()),
      ]);

      setStates(locRes?.data ?? []);
      setCategories(catRes?.data ?? []);
      setVenues((venRes?.data ?? []).filter((v: VenueRow) => v.status === "APPROVED"));

      const ev = evRes?.data;
      if (!ev) { toast.error("Event not found"); router.push("/organizer/events"); return; }
      if (ev.status !== "DRAFT" && ev.status !== "REJECTED") {
        toast.error("Only DRAFT or REJECTED events can be edited");
        router.push(`/organizer/events/${id}`);
        return;
      }

      setTitle(ev.title ?? "");
      setDescription(ev.description ?? "");
      setCategoryId(ev.category?.id ?? "");
      setVenueId(ev.venue?.id ?? "");
      setStateId(ev.state?.id ?? "");
      setCityId(ev.city?.id ?? "");
      setStartAt(toLocalDatetime(ev.startAt));
      setEndAt(toLocalDatetime(ev.endAt));
      setTimezone(ev.timezone ?? "Pacific/Auckland");
      setContactEmail(ev.contactEmail ?? "");
      setContactPhone(ev.contactPhone ?? "");
      setHeroImage(ev.heroImage ?? "");
      setCancelPolicy(ev.cancelPolicy ?? "");
      setRefundPolicy(ev.refundPolicy ?? "");
      setCommissionPct(String(ev.commissionPct ?? 10));
      setGstPct(String(ev.gstPct ?? 15));
      setPlatformFeeFixed(String(ev.platformFeeFixed ?? 0));
      setReady(true);
    }
    load();
  }, [id, router]);

  async function save() {
    if (!title.trim()) return toast.error("Event title is required");
    if (!startAt || !endAt) return toast.error("Start and end dates are required");
    if (new Date(endAt) <= new Date(startAt)) return toast.error("End date must be after start date");

    setSaving(true);
    const res = await fetch(`/api/organizer/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description: description || undefined,
        categoryId: categoryId || undefined, venueId: venueId || undefined,
        stateId: stateId || undefined, cityId: cityId || undefined,
        startAt, endAt, timezone,
        heroImage: heroImage || undefined,
        contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined,
        cancelPolicy: cancelPolicy || undefined, refundPolicy: refundPolicy || undefined,
        commissionPct: Number(commissionPct), gstPct: Number(gstPct),
        platformFeeFixed: Number(platformFeeFixed),
      }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to save event");
    toast.success("Event updated");
    router.push(`/organizer/events/${id}`);
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

  if (!ready) {
    return (
      <SidebarLayout role="organizer" title="Organizer" items={nav}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-100" />)}
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="flex items-center gap-3">
        <Link href={`/organizer/events/${id}`} className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to event
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Edit Event</h1>
        <p className="mt-1 text-sm text-neutral-500">Changes apply to DRAFT or REJECTED events only.</p>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Basic Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event Title <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="h-32 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <select className="app-select" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                  <option value="">No venue</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <select className="app-select" value={stateId} onChange={(e) => { setStateId(e.target.value); setCityId(""); }}>
                  <option value="">No state</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <select className="app-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                  <option value="">No city</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

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

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Contact & Policies</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Cancellation Policy</Label>
              <textarea
                className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                value={cancelPolicy}
                onChange={(e) => setCancelPolicy(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Refund Policy</Label>
              <textarea
                className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                value={refundPolicy}
                onChange={(e) => setRefundPolicy(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Fee Configuration</h2>
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
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/organizer/events/${id}`)}>Cancel</Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
