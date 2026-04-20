'use client';

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { PlacesAutocomplete } from "@/src/components/ui/places-autocomplete";
import { SearchableSelect } from "@/src/components/ui/searchable-select";
import { Button } from "@/src/components/ui/button";
import { matchLocation } from "@/src/lib/location-match";
import { TIMEZONES } from "@/src/lib/timezones";
import { CURRENCIES } from "@/src/lib/currency";

type CountryRow = { id: string; code: string; name: string };
type StateRow = { id: string; name: string; countryId: string | null; cities: { id: string; name: string }[] };
type CategoryRow = { id: string; name: string };
type VenueRow = { id: string; name: string; status: string };

type EventDetailsFormData = {
  title: string;
  description: string;
  categoryId: string;
  venueId: string;
  countryId: string;
  stateId: string;
  cityName: string;
  startAt: string;
  endAt: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  heroImage: string;
  videoUrl: string;
  cancelPolicy: string;
  refundPolicy: string;
  currency: string;
  commissionPct: string;
  gstPct: string;
  platformFeeFixed: string;
  tags: string[];
  audience: string;
  lat?: number;
  lng?: number;
  stateName: string;
  cityId: string;
};

export function EventDetailsStep({
  initialData,
  onNext,
}: {
  initialData?: Partial<EventDetailsFormData>;
  onNext: (data: EventDetailsFormData) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);

  // Form fields
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "");
  const [venueId, setVenueId] = useState(initialData?.venueId ?? "");
  const [countryId, setCountryId] = useState(initialData?.countryId ?? "");
  const [stateId, setStateId] = useState(initialData?.stateId ?? "");
  const [cityId, setCityId] = useState(initialData?.cityId ?? "");
  const [stateName, setStateName] = useState(initialData?.stateName ?? "");
  const [cityName, setCityName] = useState(initialData?.cityName ?? "");
  const [startAt, setStartAt] = useState(initialData?.startAt ?? "");
  const [endAt, setEndAt] = useState(initialData?.endAt ?? "");
  const [timezone, setTimezone] = useState(initialData?.timezone ?? "UTC");
  const [contactEmail, setContactEmail] = useState(initialData?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initialData?.contactPhone ?? "");
  const [heroImage, setHeroImage] = useState(initialData?.heroImage ?? "");
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl ?? "");
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [cancelPolicy, setCancelPolicy] = useState(initialData?.cancelPolicy ?? "");
  const [refundPolicy, setRefundPolicy] = useState(initialData?.refundPolicy ?? "");
  const [currency, setCurrency] = useState(initialData?.currency ?? "USD");
  const [commissionPct, setCommissionPct] = useState(initialData?.commissionPct ?? "10");
  const [gstPct, setGstPct] = useState(initialData?.gstPct ?? "15");
  const [platformFeeFixed, setPlatformFeeFixed] = useState(initialData?.platformFeeFixed ?? "0");
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [audience, setAudience] = useState(initialData?.audience ?? "");
  const [lat, setLat] = useState<number | undefined>(initialData?.lat);
  const [lng, setLng] = useState<number | undefined>(initialData?.lng);

  const filteredStates = states.filter((state) => !countryId || state.countryId === countryId);
  const cities = filteredStates.find((state) => state.id === stateId)?.cities ?? [];

  function toIsoDatetime(value: string) {
    return new Date(value).toISOString();
  }

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

  useEffect(() => {
    Promise.all([
      fetch("/api/public/locations").then((r) => r.json()),
      fetch("/api/public/categories").then((r) => r.json()),
      fetch("/api/organizer/venues").then((r) => r.json()),
    ]).then(([l, c, v]) => {
      setCountries(l?.data?.countries ?? []);
      setStates(l?.data?.states ?? []);
      setCategories(c?.data ?? []);
      setVenues((v?.data ?? []).filter((venue: { status: string }) => venue.status === "APPROVED"));
    });
  }, []);

  async function handleSubmit() {
    if (!title.trim()) return toast.error("Event title is required");
    if (!startAt || !endAt) return toast.error("Start and end dates are required");
    if (new Date(endAt) <= new Date(startAt)) return toast.error("End date must be after start date");

    setSaving(true);

    const formData: EventDetailsFormData = {
      title, description, categoryId, venueId, countryId,
      stateId, cityName, startAt, endAt, timezone, contactEmail,
      contactPhone, heroImage, videoUrl, cancelPolicy, refundPolicy,
      currency, commissionPct, gstPct, platformFeeFixed, tags, audience,
      lat, lng, stateName, cityId
    };
    onNext(formData);
    setSaving(false);
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
          <div className="space-y-2">
            <Label>Search Location</Label>
            <PlacesAutocomplete
              placeholder="Start typing a location to search..."
              onSelect={(place) => {
                if (place.lat !== undefined) setLat(place.lat);
                if (place.lng !== undefined) setLng(place.lng);
                const { countryId: cId, stateId: sId, cityId: ciId } = matchLocation(place, { countries, states });
                if (cId) setCountryId(cId);
                if (sId) setStateId(sId); else setStateId("");
                if (ciId) setCityId(ciId); else setCityId("");
                setStateName("");
                setCityName("");
                toast.success("Location auto-filled from Google Maps");
              }}
            />
            <p className="text-xs text-neutral-500">Use autocomplete when available, or choose country, state, and city manually below.</p>
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
              <Label>Country</Label>
              <SearchableSelect
                options={[{ value: "", label: "Select country (optional)" }, ...countries.map((c) => ({ value: c.id, label: c.name }))]}
                value={countryId}
                onChange={(v) => { setCountryId(v); setStateId(""); setCityId(""); }}
                placeholder="Select country (optional)"
                searchPlaceholder="Search countries..."
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <SearchableSelect
                options={[{ value: "", label: "Select state (optional)" }, ...filteredStates.map((s) => ({ value: s.id, label: s.name }))]}
                value={stateId}
                onChange={(v) => { setStateId(v); setCityId(""); if (v) setStateName(""); }}
                placeholder="Select state (optional)"
                searchPlaceholder="Search states..."
                disabled={!countryId}
              />
              <Input
                value={stateName}
                onChange={(e) => { setStateName(e.target.value); if (e.target.value.trim()) setStateId(""); }}
                placeholder="Or type state manually"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <SearchableSelect
                options={[{ value: "", label: "Select city (optional)" }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
                value={cityId}
                onChange={(v) => { setCityId(v); if (v) setCityName(""); }}
                placeholder="Select city (optional)"
                searchPlaceholder="Search cities..."
                disabled={!stateId}
              />
              <Input
                value={cityName}
                onChange={(e) => { setCityName(e.target.value); if (e.target.value.trim()) setCityId(""); }}
                placeholder="Or type city manually"
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
                <option value="21+">21+
                </option>
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

      <div className="flex justify-end gap-3">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
