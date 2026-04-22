'use client';

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Controller, type FieldErrors, type Resolver, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { SearchableSelect } from "@/src/components/ui/searchable-select";
import { TIMEZONES } from "@/src/lib/timezones";
import { combineDateTimeInTimezone, eventDetailsSchema } from "@/src/lib/validators/shared-event-schema";
import type { EventDetailsFormData } from "@/src/types/event-draft";

type CategoryOption = { id: string; name: string };
type SaveState = "idle" | "saving" | "saved";

type EventDetailsStepProps = {
  initialData?: Partial<EventDetailsFormData>;
  onNext: (data: EventDetailsFormData) => void | Promise<void>;
};

const defaultTimezone = TIMEZONES.includes("UTC") ? "UTC" : TIMEZONES[0] ?? "UTC";

const defaultDetails: EventDetailsFormData = {
  title: "",
  tagline: "",
  description: "",
  category: "",
  tags: [],
  location: {
    type: "PHYSICAL",
    venueName: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    mapLink: "",
    locationNotes: "",
  },
  schedule: {
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    startsAt: "",
    endsAt: "",
    timezone: defaultTimezone,
    isRecurring: false,
  },
  organizer: {
    organizerName: "",
    organizerEmail: "",
    organizerPhone: "",
    organizerWebsite: "",
  },
  media: {
    coverImage: "",
    gallery: [],
    promoVideoUrl: "",
  },
  policies: {
    refundPolicy: "",
    cancellationPolicy: "",
    transferAllowed: true,
    specialInstructions: "",
  },
  visibility: {
    visibility: "PUBLIC",
    slug: "",
  },
};

function slugifyDraftTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mergeDetails(initialData?: Partial<EventDetailsFormData>): EventDetailsFormData {
  return {
    ...defaultDetails,
    ...initialData,
    tags: initialData?.tags ?? defaultDetails.tags,
    location: {
      ...defaultDetails.location,
      ...(initialData?.location ?? {}),
    } as EventDetailsFormData["location"],
    schedule: {
      ...defaultDetails.schedule,
      ...(initialData?.schedule ?? {}),
      timezone: initialData?.schedule?.timezone || defaultDetails.schedule.timezone,
    },
    organizer: {
      ...defaultDetails.organizer,
      ...(initialData?.organizer ?? {}),
    },
    media: {
      ...defaultDetails.media,
      ...(initialData?.media ?? {}),
      gallery: initialData?.media?.gallery ?? defaultDetails.media.gallery,
    },
    policies: {
      ...defaultDetails.policies,
      ...(initialData?.policies ?? {}),
    },
    visibility: {
      ...defaultDetails.visibility,
      ...(initialData?.visibility ?? {}),
    },
  };
}

function getErrorMessage(errors: FieldErrors<EventDetailsFormData>, path: string[]) {
  let current: unknown = errors;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (current && typeof current === "object" && "message" in current) {
    const message = (current as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-neutral-800">{label}</Label>
      {children}
      {helper ? <p className="text-xs text-neutral-500">{helper}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function EventDetailsStep({ initialData, onNext }: EventDetailsStepProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [galleryInput, setGalleryInput] = useState("");
  const [slugEdited, setSlugEdited] = useState(Boolean(initialData?.visibility?.slug));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timezoneOptions = useMemo(
    () => Array.from(new Set(["UTC", ...TIMEZONES])).map((timezone) => ({ value: timezone, label: timezone.replace(/_/g, " ") })),
    [],
  );

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<EventDetailsFormData>({
    resolver: zodResolver(eventDetailsSchema) as Resolver<EventDetailsFormData>,
    defaultValues: mergeDetails(initialData),
    mode: "onBlur",
  });

  const title = useWatch({ control, name: "title" }) ?? "";
  const tags = useWatch({ control, name: "tags" }) ?? [];
  const gallery = useWatch({ control, name: "media.gallery" }) ?? [];
  const locationType = useWatch({ control, name: "location.type" });
  const currentSlug = useWatch({ control, name: "visibility.slug" });

  useEffect(() => {
    fetch("/api/public/categories")
      .then((response) => response.json())
      .then((payload) => setCategories(payload?.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!slugEdited) {
      setValue("visibility.slug", slugifyDraftTitle(title), { shouldDirty: true });
    }
  }, [slugEdited, setValue, title]);

  function addTag() {
    const nextTag = tagInput.trim().replace(/,+$/, "").trim();
    if (!nextTag || tags.includes(nextTag) || tags.length >= 10) return;
    setValue("tags", [...tags, nextTag], { shouldDirty: true, shouldValidate: true });
    setTagInput("");
  }

  function removeTag(tag: string) {
    setValue("tags", tags.filter((item) => item !== tag), { shouldDirty: true, shouldValidate: true });
  }

  function addGalleryImage() {
    const nextImage = galleryInput.trim();
    if (!nextImage || gallery.includes(nextImage)) return;
    setValue("media.gallery", [...gallery, nextImage], { shouldDirty: true, shouldValidate: true });
    setGalleryInput("");
  }

  function removeGalleryImage(image: string) {
    setValue("media.gallery", gallery.filter((item) => item !== image), { shouldDirty: true, shouldValidate: true });
  }

  async function submitDetails(data: EventDetailsFormData) {
    const startsAt = combineDateTimeInTimezone(data.schedule.startDate, data.schedule.startTime, data.schedule.timezone);
    const endsAt = combineDateTimeInTimezone(data.schedule.endDate, data.schedule.endTime, data.schedule.timezone);

    if (!startsAt || !endsAt) {
      setError("schedule.endTime", { message: "Choose a valid date, time, and timezone" });
      return;
    }

    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setError("schedule.endTime", { message: "End time must be after the start time" });
      return;
    }

    setSaveState("saving");
    await onNext({
      ...data,
      schedule: {
        ...data.schedule,
        startsAt,
        endsAt,
      },
      visibility: {
        ...data.visibility,
        slug: data.visibility.slug || slugifyDraftTitle(data.title),
      },
    });
    setSaveState("saved");
  }

  return (
    <form onSubmit={handleSubmit(submitDetails)} className="space-y-6">
      <section className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.06)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--theme-accent)]">Step 1 · Event Details</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Build the public event profile</h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-700">
              Add the details attendees need before ticket setup. Date, time, location, and visibility are validated before continuing.
            </p>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-sm text-neutral-600">
            {saveState === "saving" || isSubmitting ? "Saving..." : saveState === "saved" ? "Saved" : "Draft"}
          </div>
        </div>
      </section>

      <Section title="Event Basics" description="Name the event, classify it, and add searchable tags.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Title" error={errors.title?.message}>
            <Input {...register("title")} placeholder="Summer Music Festival 2026" />
          </Field>
          <Field label="Tagline" helper="Optional short line shown near the title." error={errors.tagline?.message}>
            <Input {...register("tagline")} placeholder="One night. Three stages. Local food." />
          </Field>
        </div>
        <Field label="Description" error={errors.description?.message}>
          <Textarea {...register("description")} className="min-h-36" placeholder="Describe the event, lineup, schedule highlights, accessibility details, and what attendees should expect." />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Category" error={errors.category?.message}>
            <select className="app-select" {...register("category")}>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tags" helper="Press Enter or comma to add up to 10 tags.">
            <div className="space-y-3">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.1)] px-3 py-1 text-sm text-[var(--theme-accent)]">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="text-xs hover:opacity-70">x</button>
                    </span>
                  ))}
                </div>
              ) : null}
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag"
              />
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Event Type & Location" description="Capture the correct location fields based on whether the event is physical or online.">
        <Field label="Event Type" error={getErrorMessage(errors, ["location", "type"])}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["PHYSICAL", "ONLINE"] as const).map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-neutral-800">
                <input type="radio" value={type} {...register("location.type")} />
                <span>{type === "PHYSICAL" ? "Physical venue" : "Online event"}</span>
              </label>
            ))}
          </div>
        </Field>

        {locationType === "PHYSICAL" ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Venue Name" error={getErrorMessage(errors, ["location", "venueName"])}>
              <Input {...register("location.venueName")} placeholder="Town Hall Auditorium" />
            </Field>
            <Field label="Address" error={getErrorMessage(errors, ["location", "address"])}>
              <Input {...register("location.address")} placeholder="123 Main Street" />
            </Field>
            <Field label="City" error={getErrorMessage(errors, ["location", "city"])}>
              <Input {...register("location.city")} placeholder="New York" />
            </Field>
            <Field label="State / Region" error={getErrorMessage(errors, ["location", "state"])}>
              <Input {...register("location.state")} placeholder="NY" />
            </Field>
            <Field label="Country" error={getErrorMessage(errors, ["location", "country"])}>
              <Input {...register("location.country")} placeholder="United States" />
            </Field>
            <Field label="Postal Code" error={getErrorMessage(errors, ["location", "postalCode"])}>
              <Input {...register("location.postalCode")} placeholder="10001" />
            </Field>
            <Field label="Map Link" error={getErrorMessage(errors, ["location", "mapLink"])}>
              <Input {...register("location.mapLink")} placeholder="https://maps.google.com/..." />
            </Field>
            <Field label="Location Notes" error={getErrorMessage(errors, ["location", "locationNotes"])}>
              <Textarea {...register("location.locationNotes")} placeholder="Parking, entry gate, accessibility, or arrival notes." />
            </Field>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Platform" error={getErrorMessage(errors, ["location", "platform"])}>
              <Input {...register("location.platform")} placeholder="Zoom, Google Meet, Hopin..." />
            </Field>
            <Field label="Access Link" error={getErrorMessage(errors, ["location", "accessLink"])}>
              <Input {...register("location.accessLink")} placeholder="https://..." />
            </Field>
            <div className="md:col-span-2">
              <Field label="Access Instructions" error={getErrorMessage(errors, ["location", "accessInstructions"])}>
                <Textarea {...register("location.accessInstructions")} placeholder="Tell attendees when and how the online link will be available." />
              </Field>
            </div>
          </div>
        )}
      </Section>

      <Section title="Date & Time" description="Choose date, time, and timezone together. We store safe ISO timestamps in the draft.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Start Date" error={getErrorMessage(errors, ["schedule", "startDate"])}>
            <Input type="date" {...register("schedule.startDate")} />
          </Field>
          <Field label="Start Time" error={getErrorMessage(errors, ["schedule", "startTime"])}>
            <Input type="time" {...register("schedule.startTime")} />
          </Field>
          <Field label="End Date" error={getErrorMessage(errors, ["schedule", "endDate"])}>
            <Input type="date" {...register("schedule.endDate")} />
          </Field>
          <Field label="End Time" error={getErrorMessage(errors, ["schedule", "endTime"])}>
            <Input type="time" {...register("schedule.endTime")} />
          </Field>
          <Field label="Timezone" error={getErrorMessage(errors, ["schedule", "timezone"])}>
            <Controller
              name="schedule.timezone"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={timezoneOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select timezone"
                  searchPlaceholder="Search timezones..."
                />
              )}
            />
          </Field>
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-neutral-700">
            <input type="checkbox" {...register("schedule.isRecurring")} />
            <span>This is a recurring event</span>
          </label>
        </div>
      </Section>

      <Section title="Organizer Info" description="Show attendees who is running the event and how to contact them.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Organizer Name" error={getErrorMessage(errors, ["organizer", "organizerName"])}>
            <Input {...register("organizer.organizerName")} placeholder="Eventsbox Productions" />
          </Field>
          <Field label="Organizer Email" error={getErrorMessage(errors, ["organizer", "organizerEmail"])}>
            <Input type="email" {...register("organizer.organizerEmail")} placeholder="hello@example.com" />
          </Field>
          <Field label="Organizer Phone" error={getErrorMessage(errors, ["organizer", "organizerPhone"])}>
            <Input {...register("organizer.organizerPhone")} placeholder="+1 555 123 4567" />
          </Field>
          <Field label="Organizer Website" error={getErrorMessage(errors, ["organizer", "organizerWebsite"])}>
            <Input {...register("organizer.organizerWebsite")} placeholder="https://example.com" />
          </Field>
        </div>
      </Section>

      <Section title="Event Media" description="Add the visuals attendees will see on the event page.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Cover Image" error={getErrorMessage(errors, ["media", "coverImage"])}>
            <Input {...register("media.coverImage")} placeholder="https://..." />
          </Field>
          <Field label="Promo Video URL" error={getErrorMessage(errors, ["media", "promoVideoUrl"])}>
            <Input {...register("media.promoVideoUrl")} placeholder="https://youtube.com/watch?v=..." />
          </Field>
        </div>
        <Field label="Gallery" helper="Add image URLs for the event gallery.">
          <div className="space-y-3">
            {gallery.length > 0 ? (
              <div className="grid gap-2">
                {gallery.map((image) => (
                  <div key={image} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                    <span className="truncate">{image}</span>
                    <button type="button" onClick={() => removeGalleryImage(image)} className="text-red-600 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input value={galleryInput} onChange={(event) => setGalleryInput(event.target.value)} placeholder="https://..." />
              <Button type="button" variant="outline" onClick={addGalleryImage}>Add</Button>
            </div>
            {getErrorMessage(errors, ["media", "gallery"]) ? <p className="text-sm text-red-600">{getErrorMessage(errors, ["media", "gallery"])}</p> : null}
          </div>
        </Field>
      </Section>

      <Section title="Policies" description="Set expectations for refunds, cancellations, transfers, and attendee instructions.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Refund Policy" error={getErrorMessage(errors, ["policies", "refundPolicy"])}>
            <Textarea {...register("policies.refundPolicy")} placeholder="Describe refund eligibility and timing." />
          </Field>
          <Field label="Cancellation Policy" error={getErrorMessage(errors, ["policies", "cancellationPolicy"])}>
            <Textarea {...register("policies.cancellationPolicy")} placeholder="Explain what happens if the event is cancelled." />
          </Field>
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-neutral-700">
            <input type="checkbox" {...register("policies.transferAllowed")} />
            <span>Allow ticket transfers</span>
          </label>
          <Field label="Special Instructions" error={getErrorMessage(errors, ["policies", "specialInstructions"])}>
            <Textarea {...register("policies.specialInstructions")} placeholder="Age restrictions, entry requirements, prohibited items, or accessibility notes." />
          </Field>
        </div>
      </Section>

      <Section title="Visibility" description="Control how attendees can find the event.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Visibility" error={getErrorMessage(errors, ["visibility", "visibility"])}>
            <select className="app-select" {...register("visibility.visibility")}>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
              <option value="UNLISTED">Unlisted</option>
            </select>
          </Field>
          <Field label="Slug" helper="Auto-generated from the title, but editable." error={getErrorMessage(errors, ["visibility", "slug"])}>
            <Input
              value={currentSlug ?? ""}
              onChange={(event) => {
                setSlugEdited(true);
                setValue("visibility.slug", slugifyDraftTitle(event.target.value), { shouldDirty: true, shouldValidate: true });
              }}
              placeholder="event-url-slug"
            />
          </Field>
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-5">
        <span className="text-sm text-neutral-500">
          {saveState === "saving" || isSubmitting ? "Saving..." : saveState === "saved" ? "Saved" : null}
        </span>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Next: Tickets"}
        </Button>
      </div>
    </form>
  );
}
