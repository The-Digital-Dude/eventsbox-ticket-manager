"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Film, Globe2, ImagePlus, MapPin, Ticket } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { PlacesAutocomplete } from "@/src/components/ui/places-autocomplete";
import { SearchableSelect } from "@/src/components/ui/searchable-select";
import { matchLocation } from "@/src/lib/location-match";
import { TIMEZONES } from "@/src/lib/timezones";
import { CURRENCIES } from "@/src/lib/currency";
import { nav } from "@/app/organizer/nav";

type CountryRow = { id: string; code: string; name: string };
type StateRow = { id: string; name: string; countryId: string | null; cities: { id: string; name: string }[] };
type CategoryRow = { id: string; name: string };
type VenueRow = { id: string; name: string; status: string };
type EventMode = "SIMPLE" | "RESERVED_SEATING";
type EventType = "PHYSICAL" | "ONLINE";
type EventVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
type LocationMode = "ONE_TIME" | "SAVED_VENUE";

const steps = [
  "Mode Selection",
  "Event Details",
  "Location & Date",
  "Media",
  "Review & Create",
] as const;

const modeCards: { value: EventMode; title: string; description: string }[] = [
  {
    value: "SIMPLE",
    title: "Simple Event",
    description: "General admission or online event setup with ticket types added after creation.",
  },
  {
    value: "RESERVED_SEATING",
    title: "Reserved Seating Event",
    description: "Create the event shell now, then configure seating sections, rows, tables, and pricing.",
  },
];

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function formatPreviewDate(value: string) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function NewEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);

  const [mode, setMode] = useState<EventMode | "">("");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("PHYSICAL");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState<EventVisibility>("PUBLIC");
  const [locationMode, setLocationMode] = useState<LocationMode>("ONE_TIME");
  const [venueId, setVenueId] = useState("");
  const [venueName, setVenueName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [stateName, setStateName] = useState("");
  const [cityName, setCityName] = useState("");
  const [onlineAccessLink, setOnlineAccessLink] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [heroImage, setHeroImage] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryInput, setGalleryInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [cancelPolicy, setCancelPolicy] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [commissionPct, setCommissionPct] = useState("10");
  const [gstPct, setGstPct] = useState("15");
  const [platformFeeFixed, setPlatformFeeFixed] = useState("0");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [audience, setAudience] = useState("");
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const selectedVenue = venues.find((venue) => venue.id === venueId);
  const selectedCountry = countries.find((country) => country.id === countryId);
  const selectedState = states.find((state) => state.id === stateId);
  const selectedCity = states.flatMap((state) => state.cities).find((city) => city.id === cityId);
  const locationLabel = eventType === "ONLINE"
    ? "Online"
    : locationMode === "SAVED_VENUE"
      ? selectedVenue?.name || "Location not set"
      : venueName || [cityName || selectedCity?.name, stateName || selectedState?.name, selectedCountry?.name].filter(Boolean).join(", ") || "Location not set";

  const summaryRows = useMemo(() => [
    ["Mode", mode === "RESERVED_SEATING" ? "Reserved Seating Event" : mode === "SIMPLE" ? "Simple Event" : "Not selected"],
    ["Type", eventType === "ONLINE" ? "Online" : "Physical"],
    ["Visibility", visibility],
    ["Category", selectedCategory?.name ?? "Uncategorized"],
    ["Starts", formatPreviewDate(startAt)],
    ["Ends", formatPreviewDate(endAt)],
    ["Location", locationLabel],
    ["Media", `${heroImage ? "Hero image" : "No hero image"} - ${galleryImages.length} gallery image${galleryImages.length === 1 ? "" : "s"}`],
  ], [eventType, galleryImages.length, heroImage, locationLabel, mode, selectedCategory?.name, startAt, endAt, visibility]);

  useEffect(() => {
    Promise.all([
      fetch("/api/public/locations").then((res) => res.json()),
      fetch("/api/public/categories").then((res) => res.json()),
      fetch("/api/organizer/venues").then((res) => res.json()),
    ]).then(([locations, categoryPayload, venuePayload]) => {
      setCountries(locations?.data?.countries ?? []);
      setStates(locations?.data?.states ?? []);
      setCategories(categoryPayload?.data ?? []);
      setVenues((venuePayload?.data ?? []).filter((venue: VenueRow) => venue.status === "APPROVED"));
    }).catch(() => toast.error("Some setup data could not be loaded"));
  }, []);

  function addTag(value: string) {
    const trimmed = value.trim().replace(/,+$/, "").trim();
    if (!trimmed) return;
    if (trimmed.length > 30) return toast.error("Tag must be 30 characters or fewer");
    if (tags.length >= 10) return toast.error("Maximum 10 tags allowed");
    if (tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
  }

  function addGalleryImage(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (galleryImages.length >= 10) return toast.error("Maximum 10 gallery images allowed");
    try {
      new URL(trimmed);
    } catch {
      return toast.error("Gallery image must be a valid URL");
    }
    if (galleryImages.includes(trimmed)) return;
    setGalleryImages((prev) => [...prev, trimmed]);
    setGalleryInput("");
  }

  function validateStep(currentStep = step) {
    if (currentStep === 0 && !mode) {
      toast.error("Choose an event mode before continuing");
      return false;
    }
    if (currentStep === 1 && title.trim().length < 3) {
      toast.error("Event title must be at least 3 characters");
      return false;
    }
    if (currentStep === 2) {
      if (eventType === "ONLINE" && onlineAccessLink.trim()) {
        try {
          new URL(onlineAccessLink);
        } catch {
          toast.error("Online access link must be a valid URL");
          return false;
        }
      }
      if (!startAt || !endAt) {
        toast.error("Start and end dates are required");
        return false;
      }
      if (new Date(endAt) <= new Date(startAt)) {
        toast.error("End date must be after start date");
        return false;
      }
      if (eventType === "PHYSICAL" && locationMode === "SAVED_VENUE" && !venueId) {
        toast.error("Select a saved venue");
        return false;
      }
      if (eventType === "PHYSICAL" && locationMode === "ONE_TIME") {
        if (venueName.trim().length < 2) {
          toast.error("Venue name is required");
          return false;
        }
        if (addressLine1.trim().length < 3) {
          toast.error("Address line 1 is required");
          return false;
        }
        if (!stateName.trim() || !cityName.trim()) {
          toast.error("State and city are required");
          return false;
        }
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
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

  async function submit() {
    for (let index = 0; index < steps.length - 1; index += 1) {
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    setSaving(true);
    const res = await fetch("/api/organizer/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        title,
        tagline: tagline || undefined,
        description: description || undefined,
        eventType,
        categoryId: categoryId || undefined,
        tags,
        visibility,
        locationMode: eventType === "PHYSICAL" ? locationMode : undefined,
        venueId: eventType === "PHYSICAL" && locationMode === "SAVED_VENUE" ? venueId || undefined : undefined,
        oneTimeVenue: eventType === "PHYSICAL" && locationMode === "ONE_TIME"
          ? {
              name: venueName,
              addressLine1,
              addressLine2: addressLine2 || undefined,
              countryId: countryId || undefined,
              stateId: stateId || undefined,
              cityId: cityId || undefined,
              stateName,
              cityName,
              categoryId: categoryId || undefined,
              lat,
              lng,
            }
          : undefined,
        countryId: eventType === "PHYSICAL" && locationMode === "ONE_TIME" ? countryId || undefined : undefined,
        stateId: eventType === "PHYSICAL" && locationMode === "ONE_TIME" ? stateId || undefined : undefined,
        cityId: eventType === "PHYSICAL" && locationMode === "ONE_TIME" ? cityId || undefined : undefined,
        onlineAccessLink: eventType === "ONLINE" ? onlineAccessLink || undefined : undefined,
        startAt: toIsoDateTime(startAt),
        endAt: toIsoDateTime(endAt),
        timezone,
        heroImage: heroImage || undefined,
        images: galleryImages,
        videoUrl: videoUrl || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        cancelPolicy: cancelPolicy || undefined,
        refundPolicy: refundPolicy || undefined,
        currency,
        commissionPct: Number(commissionPct),
        gstPct: Number(gstPct),
        platformFeeFixed: Number(platformFeeFixed),
        audience: audience || undefined,
        lat: eventType === "PHYSICAL" ? lat : undefined,
        lng: eventType === "PHYSICAL" ? lng : undefined,
        draftStep: steps.length - 1,
      }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to create event");
    toast.success("Event created");
    router.push(mode === "RESERVED_SEATING" ? `/organizer/events/${payload.data.id}/seating` : `/organizer/events/${payload.data.id}`);
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Create New Event" subtitle="Build the event shell step by step. Tickets come next." />

      <div className="space-y-6">
        <nav className="grid gap-2 md:grid-cols-5" aria-label="Event creation steps">
          {steps.map((label, index) => {
            const active = index === step;
            const complete = index < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (index <= step || validateStep()) setStep(index);
                }}
                className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                  active
                    ? "border-[var(--theme-accent)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-neutral-950"
                    : complete
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-[var(--border)] bg-white text-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${complete ? "bg-emerald-600 text-white" : active ? "bg-[var(--theme-accent)] text-white" : "bg-neutral-100 text-neutral-600"}`}>
                    {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Choose Event Mode</h2>
                <p className="mt-1 text-sm text-neutral-600">This controls whether the event starts as standard ticketing or reserved seating.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {modeCards.map((card) => (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => setMode(card.value)}
                    className={`min-h-44 rounded-2xl border p-5 text-left transition ${
                      mode === card.value
                        ? "border-[var(--theme-accent)] bg-[rgb(var(--theme-accent-rgb)/0.08)] shadow-sm"
                        : "border-[var(--border)] bg-white hover:border-[rgb(var(--theme-accent-rgb)/0.4)]"
                    }`}
                  >
                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-800">
                      <Ticket className="h-5 w-5" />
                    </span>
                    <span className="block text-lg font-semibold text-neutral-900">{card.title}</span>
                    <span className="mt-2 block text-sm leading-6 text-neutral-600">{card.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Event Details</h2>
                <p className="mt-1 text-sm text-neutral-600">Set the audience-facing basics and discovery metadata.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Event Title <span className="text-red-500">*</span></Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Summer Music Festival 2026" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tagline</Label>
                  <Input value={tagline} onChange={(event) => setTagline(event.target.value)} maxLength={160} placeholder="A short line that sells the moment" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <textarea
                    className="h-32 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe your event..."
                    maxLength={5000}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <select className="app-select" value={eventType} onChange={(event) => setEventType(event.target.value as EventType)}>
                    <option value="PHYSICAL">Physical</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select className="app-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">Select category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <select className="app-select" value={visibility} onChange={(event) => setVisibility(event.target.value as EventVisibility)}>
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                    <option value="UNLISTED">Unlisted</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <select className="app-select" value={audience} onChange={(event) => setAudience(event.target.value)}>
                    <option value="">All Ages</option>
                    <option value="Families">Families</option>
                    <option value="Kids (Under 12)">Kids (Under 12)</option>
                    <option value="Teens (13-17)">Teens (13-17)</option>
                    <option value="18+">18+</option>
                    <option value="21+">21+</option>
                    <option value="Professionals">Professionals</option>
                    <option value="Seniors">Seniors</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tags</Label>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.1)] px-3 py-1 text-sm text-[var(--theme-accent)]">
                          {tag}
                          <button type="button" onClick={() => setTags((prev) => prev.filter((item) => item !== tag))} className="hover:opacity-70">x</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTag(tagInput);
                        setTagInput("");
                      }
                    }}
                    placeholder="Add a tag, then press Enter"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Location & Date</h2>
                  <p className="mt-1 text-sm text-neutral-600">Tell attendees where and when to show up.</p>
                </div>
                {eventType === "PHYSICAL" ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        ["ONE_TIME", "One-time venue", "Use this location for this event only."],
                        ["SAVED_VENUE", "Saved venue", "Copy seating from an approved venue."],
                      ] as const).map(([value, label, copy]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setLocationMode(value)}
                          className={`rounded-xl border p-4 text-left transition ${
                            locationMode === value
                              ? "border-[var(--theme-accent)] bg-[rgb(var(--theme-accent-rgb)/0.08)]"
                              : "border-[var(--border)] bg-white hover:border-[rgb(var(--theme-accent-rgb)/0.35)]"
                          }`}
                        >
                          <span className="block text-sm font-semibold text-neutral-900">{label}</span>
                          <span className="mt-1 block text-xs text-neutral-500">{copy}</span>
                        </button>
                      ))}
                    </div>

                    {locationMode === "SAVED_VENUE" ? (
                      <div className="space-y-2">
                        <Label>Venue</Label>
                        <select className="app-select" value={venueId} onChange={(event) => setVenueId(event.target.value)}>
                          <option value="">Select venue</option>
                          {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Venue Name <span className="text-red-500">*</span></Label>
                            <Input value={venueName} onChange={(event) => setVenueName(event.target.value)} placeholder="e.g. Convention Hall A" />
                          </div>
                          <div className="space-y-2">
                            <Label>Search Address</Label>
                            <PlacesAutocomplete
                              placeholder="Start typing a location to search..."
                              onSelect={(place) => {
                                if (place.address) setAddressLine1(place.address);
                                if (place.lat !== undefined) setLat(place.lat);
                                if (place.lng !== undefined) setLng(place.lng);
                                const { countryId: nextCountryId, stateId: nextStateId, cityId: nextCityId } = matchLocation(place, { countries, states });
                                if (nextCountryId) setCountryId(nextCountryId);
                                setStateId(nextStateId ?? "");
                                setCityId(nextCityId ?? "");
                                setStateName(states.find((state) => state.id === nextStateId)?.name ?? "");
                                setCityName(states.flatMap((state) => state.cities).find((city) => city.id === nextCityId)?.name ?? "");
                                toast.success("Location auto-filled from Google Maps");
                              }}
                            />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Address Line 1 <span className="text-red-500">*</span></Label>
                            <Input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Address Line 2</Label>
                            <Input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <SearchableSelect
                              options={[{ value: "", label: "Select country" }, ...countries.map((country) => ({ value: country.id, label: country.name }))]}
                              value={countryId}
                              onChange={(value) => { setCountryId(value); setStateId(""); setCityId(""); setStateName(""); setCityName(""); }}
                              placeholder="Select country"
                              searchPlaceholder="Search countries..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            <Input
                              type="text"
                              value={stateName}
                              onChange={(event) => {
                                const value = event.target.value;
                                setStateName(value);
                                const match = states.find((state) => state.name.toLowerCase() === value.trim().toLowerCase());
                                setStateId(match?.id ?? "");
                                if (!match || match.id !== stateId) {
                                  setCityId("");
                                }
                              }}
                              placeholder="Enter state"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input
                              type="text"
                              value={cityName}
                              onChange={(event) => {
                                const value = event.target.value;
                                setCityName(value);
                                const state = states.find((item) => item.id === stateId || item.name.toLowerCase() === stateName.trim().toLowerCase());
                                const match = state?.cities.find((city) => city.name.toLowerCase() === value.trim().toLowerCase());
                                setCityId(match?.id ?? "");
                              }}
                              placeholder="Enter city"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Online Access Link</Label>
                    <Input type="url" value={onlineAccessLink} onChange={(event) => setOnlineAccessLink(event.target.value)} placeholder="https://example.com/live-room" />
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Start Date & Time <span className="text-red-500">*</span></Label>
                    <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date & Time <span className="text-red-500">*</span></Label>
                    <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <SearchableSelect
                      options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))}
                      value={timezone}
                      onChange={setTimezone}
                      placeholder="Select timezone"
                      searchPlaceholder="Search timezones..."
                    />
                  </div>
                </div>
              </div>
              <LivePreview
                title={title}
                tagline={tagline}
                heroImage={heroImage}
                startAt={startAt}
                locationLabel={locationLabel}
                eventType={eventType}
                visibility={visibility}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Media</h2>
                <p className="mt-1 text-sm text-neutral-600">Add the visuals attendees will see on discovery and event pages.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>Hero Image</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void uploadHero(file);
                    }}
                  />
                  <Input value={heroImage} onChange={(event) => setHeroImage(event.target.value)} placeholder="Or paste image URL" />
                  {uploadingHeroImage && <p className="text-xs text-neutral-500">Uploading image...</p>}
                  {heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={heroImage} alt="Event hero preview" className="h-48 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-neutral-50 text-neutral-500">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label>Gallery Images</Label>
                  <div className="flex gap-2">
                    <Input value={galleryInput} onChange={(event) => setGalleryInput(event.target.value)} placeholder="Paste gallery image URL" />
                    <Button type="button" variant="outline" onClick={() => addGalleryImage(galleryInput)}>Add</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {galleryImages.map((image) => (
                      <div key={image} className="group relative overflow-hidden rounded-xl border border-[var(--border)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt="Gallery preview" className="h-24 w-full object-cover" />
                        <button type="button" onClick={() => setGalleryImages((prev) => prev.filter((item) => item !== image))} className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-xs shadow-sm">Remove</button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Video URL</Label>
                    <Input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="tickets@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+64 9 123 4567" />
                </div>
                <div className="space-y-2">
                  <Label>Cancellation Policy</Label>
                  <textarea className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]" value={cancelPolicy} onChange={(event) => setCancelPolicy(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Refund Policy</Label>
                  <textarea className="h-20 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]" value={refundPolicy} onChange={(event) => setRefundPolicy(event.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Review & Create</h2>
                <p className="mt-1 text-sm text-neutral-600">Confirm the event shell before adding tickets and seating details.</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <h3 className="font-semibold text-neutral-900">{title || "Untitled event"}</h3>
                    {tagline && <p className="mt-1 text-sm text-neutral-600">{tagline}</p>}
                    {description && <p className="mt-3 line-clamp-4 text-sm leading-6 text-neutral-600">{description}</p>}
                  </div>
                  <dl className="grid gap-3 md:grid-cols-2">
                    {summaryRows.map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
                        <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
                        <dd className="mt-1 text-sm font-medium text-neutral-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <h3 className="font-semibold text-neutral-900">Fee Configuration</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <select className="app-select" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                          {CURRENCIES.map((currencyOption) => (
                            <option key={currencyOption.code} value={currencyOption.code}>{currencyOption.code} - {currencyOption.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Commission %</Label>
                        <Input type="number" min="0" max="100" step="0.5" value={commissionPct} onChange={(event) => setCommissionPct(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>GST %</Label>
                        <Input type="number" min="0" max="100" step="0.5" value={gstPct} onChange={(event) => setGstPct(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fixed Fee</Label>
                        <Input type="number" min="0" step="0.01" value={platformFeeFixed} onChange={(event) => setPlatformFeeFixed(event.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
                <LivePreview
                  title={title}
                  tagline={tagline}
                  heroImage={heroImage}
                  startAt={startAt}
                  locationLabel={locationLabel}
                  eventType={eventType}
                  visibility={visibility}
                />
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => step === 0 ? router.back() : setStep((current) => current - 1)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? "Creating..." : "Create Event"}
            </Button>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}

function LivePreview({
  title,
  tagline,
  heroImage,
  startAt,
  locationLabel,
  eventType,
  visibility,
}: {
  title: string;
  tagline: string;
  heroImage: string;
  startAt: string;
  locationLabel: string;
  eventType: EventType;
  visibility: EventVisibility;
}) {
  return (
    <aside className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="Event preview" className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-neutral-100 text-neutral-500">
            <ImagePlus className="h-7 w-7" />
          </div>
        )}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              Draft
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
              {visibility}
            </span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-950">{title || "Untitled event"}</h3>
            {tagline && <p className="mt-1 text-sm text-neutral-600">{tagline}</p>}
          </div>
          <p className="flex items-center gap-2 text-sm text-neutral-700">
            <CalendarDays className="h-4 w-4 text-neutral-500" />
            {formatPreviewDate(startAt)}
          </p>
          <p className="flex items-center gap-2 text-sm text-neutral-700">
            {eventType === "ONLINE" ? <Globe2 className="h-4 w-4 text-neutral-500" /> : <MapPin className="h-4 w-4 text-neutral-500" />}
            {locationLabel}
          </p>
          {eventType === "ONLINE" && (
            <p className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              <Globe2 className="h-3.5 w-3.5" />
              Online event
            </p>
          )}
          <p className="flex items-center gap-2 text-xs text-neutral-500">
            <Film className="h-3.5 w-3.5" />
            Media can be changed later from edit event.
          </p>
        </div>
      </div>
    </aside>
  );
}
