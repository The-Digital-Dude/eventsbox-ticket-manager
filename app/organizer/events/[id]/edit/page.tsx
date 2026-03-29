"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { SearchableSelect } from "@/src/components/ui/searchable-select";
import Link from "next/link";
import { TIMEZONES } from "@/src/lib/timezones";
import { CURRENCIES } from "@/src/lib/currency";

type CountryRow = { id: string; code: string; name: string };
type StateRow = { id: string; name: string; cities: { id: string; name: string }[] };
type CategoryRow = { id: string; name: string };
type VenueRow = { id: string; name: string; status: string };

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/affiliate", label: "Affiliate Links" },
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
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone, setTimezone] = useState("Pacific/Auckland");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [cancelPolicy, setCancelPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [customConfirmationMessage, setCustomConfirmationMessage] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [commissionPct, setCommissionPct] = useState("10");
  const [gstPct, setGstPct] = useState("15");
  const [platformFeeFixed, setPlatformFeeFixed] = useState("0");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [audience, setAudience] = useState("");

  const cities = states.find((s) => s.id === stateId)?.cities ?? [];

  function addTag(value: string) {
    const trimmed = value.trim().replace(/,+$/, "").trim();
    if (!trimmed) return;
    if (trimmed.length > 30) return toast.error("Tag must be 30 characters or fewer");
    if (tags.length >= 10) return toast.error("Maximum 10 tags allowed");
    if (tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

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

      setCountries(locRes?.data?.countries ?? []);
      setStates(locRes?.data?.states ?? []);
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
      setCountryId(ev.country?.id ?? "");
      setStateId(ev.state?.id ?? "");
      setCityId(ev.city?.id ?? "");
      setStartAt(toLocalDatetime(ev.startAt));
      setEndAt(toLocalDatetime(ev.endAt));
      setTimezone(ev.timezone ?? "Pacific/Auckland");
      setContactEmail(ev.contactEmail ?? "");
      setContactPhone(ev.contactPhone ?? "");
      setHeroImage(ev.heroImage ?? "");
      setVideoUrl(ev.videoUrl ?? "");
      setCancelPolicy(ev.cancelPolicy ?? "");
      setRefundPolicy(ev.refundPolicy ?? "");
      setCustomConfirmationMessage(ev.customConfirmationMessage ?? "");
      setCurrency(ev.currency ?? "USD");
      setCommissionPct(String(ev.commissionPct ?? 10));
      setGstPct(String(ev.gstPct ?? 15));
      setPlatformFeeFixed(String(ev.platformFeeFixed ?? 0));
      setTags(Array.isArray(ev.tags) ? ev.tags : []);
      setAudience(ev.audience ?? "");
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
        countryId: countryId || undefined,
        stateId: stateId || undefined, cityId: cityId || undefined,
        startAt, endAt, timezone,
        heroImage: heroImage || undefined,
        videoUrl: videoUrl || undefined,
        contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined,
        cancelPolicy: cancelPolicy || undefined, refundPolicy: refundPolicy || undefined,
        customConfirmationMessage: customConfirmationMessage || null,
        currency,
        commissionPct: Number(commissionPct), gstPct: Number(gstPct),
        platformFeeFixed: Number(platformFeeFixed),
        tags,
        audience: audience || undefined,
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
            <div className="space-y-2">
              <Label>Promo Video (optional)</Label>
              <Input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
              />
              <p className="text-xs text-neutral-500">Paste a YouTube or Vimeo link to show a video on your event page</p>
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
                <Label>Country</Label>
                <SearchableSelect
                  options={[{ value: "", label: "No country" }, ...countries.map((c) => ({ value: c.id, label: c.name }))]}
                  value={countryId}
                  onChange={(v) => { setCountryId(v); setStateId(""); setCityId(""); }}
                  placeholder="No country"
                  searchPlaceholder="Search countries..."
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <SearchableSelect
                  options={[{ value: "", label: "No state" }, ...states.map((s) => ({ value: s.id, label: s.name }))]}
                  value={stateId}
                  onChange={(v) => { setStateId(v); setCityId(""); }}
                  placeholder="No state"
                  searchPlaceholder="Search states..."
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <SearchableSelect
                  options={[{ value: "", label: "No city" }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
                  value={cityId}
                  onChange={setCityId}
                  placeholder="No city"
                  searchPlaceholder="Search cities..."
                  disabled={!stateId}
                />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <select className="app-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="">All Ages (default)</option>
                  <option value="Families">Families</option>
                  <option value="Kids (Under 12)">Kids (Under 12)</option>
                  <option value="Teens (13-17)">Teens (13-17)</option>
                  <option value="18+">18+</option>
                  <option value="21+">21+</option>
                  <option value="Professionals">Professionals</option>
                  <option value="Seniors">Seniors</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.1)] px-3 py-1 text-sm text-[var(--theme-accent)]">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70">×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={tagInput}
                placeholder="Add a tag..."
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                    setTagInput("");
                  }
                }}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
              />
              <p className="text-xs text-neutral-500">Press Enter or comma to add a tag. Max 10 tags, 30 chars each.</p>
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
              <SearchableSelect
                options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))}
                value={timezone}
                onChange={setTimezone}
                placeholder="Select timezone"
                searchPlaceholder="Search timezones..."
              />
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
            <div className="space-y-2 md:col-span-2">
              <Label>Custom message sent in order confirmation emails (optional)</Label>
              <textarea
                className="h-28 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                value={customConfirmationMessage}
                onChange={(e) => setCustomConfirmationMessage(e.target.value)}
                maxLength={1000}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Fee Configuration</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Currency</Label>
              <select className="app-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Platform Commission (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>GST (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fixed Platform Fee</Label>
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
