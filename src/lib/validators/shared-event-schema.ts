import { z } from "zod";

const optionalTrimmedText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().url("Enter a valid URL").optional(),
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email("Enter a valid email address").optional(),
);

const optionalDateTime = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().datetime().optional(),
);

function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidClockTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function getTimeZoneOffsetMs(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return zonedAsUtc - date.getTime();
}

export function combineDateTimeInTimezone(dateValue: string, timeValue: string, timezone: string): string | null {
  if (!dateValue || !timeValue || !timezone || !isValidCalendarDate(dateValue) || !isValidClockTime(timeValue)) {
    return null;
  }

  try {
    const [year, month, day] = dateValue.split("-").map(Number);
    const [hours, minutes] = timeValue.split(":").map(Number);
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    const offset = getTimeZoneOffsetMs(utcGuess, timezone);
    const zonedDate = new Date(utcGuess.getTime() - offset);

    if (Number.isNaN(zonedDate.getTime())) {
      return null;
    }

    return zonedDate.toISOString();
  } catch {
    return null;
  }
}

const physicalLocationSchema = z.object({
  type: z.literal("PHYSICAL"),
  venueName: z.string().trim().min(1, "Venue name is required"),
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: optionalTrimmedText,
  country: z.string().trim().min(1, "Country is required"),
  postalCode: optionalTrimmedText,
  mapLink: optionalUrl,
  locationNotes: optionalTrimmedText,
});

const onlineLocationSchema = z.object({
  type: z.literal("ONLINE"),
  platform: optionalTrimmedText,
  accessLink: z.string().trim().url("A valid access link is required"),
  accessInstructions: optionalTrimmedText,
});

const scheduleSchema = z
  .object({
    startDate: z.string().trim().min(1, "Start date is required"),
    startTime: z.string().trim().min(1, "Start time is required"),
    endDate: z.string().trim().min(1, "End date is required"),
    endTime: z.string().trim().min(1, "End time is required"),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    timezone: z.string().trim().min(1, "Timezone is required"),
    isRecurring: z.boolean().optional().default(false),
  })
  .superRefine((schedule, ctx) => {
    const startsAt = combineDateTimeInTimezone(schedule.startDate, schedule.startTime, schedule.timezone);
    const endsAt = combineDateTimeInTimezone(schedule.endDate, schedule.endTime, schedule.timezone);

    if (!startsAt) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Start date and time must be valid" });
    }
    if (!endsAt) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End date and time must be valid" });
    }
    if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start time" });
    }
  });

const publishableScheduleSchema = z
  .object({
    startDate: z.string().trim().min(1, "Start date is required"),
    startTime: z.string().trim().min(1, "Start time is required"),
    endDate: z.string().trim().min(1, "End date is required"),
    endTime: z.string().trim().min(1, "End time is required"),
    startsAt: z.string().datetime("Start timestamp is required"),
    endsAt: z.string().datetime("End timestamp is required"),
    timezone: z.string().trim().min(1, "Timezone is required"),
    isRecurring: z.boolean().optional().default(false),
  })
  .superRefine((schedule, ctx) => {
    const startsAt = combineDateTimeInTimezone(schedule.startDate, schedule.startTime, schedule.timezone);
    const endsAt = combineDateTimeInTimezone(schedule.endDate, schedule.endTime, schedule.timezone);

    if (!startsAt || startsAt !== schedule.startsAt) {
      ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Start timestamp must match the selected date, time, and timezone" });
    }
    if (!endsAt || endsAt !== schedule.endsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End timestamp must match the selected date, time, and timezone" });
    }
    if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start time" });
    }
  });

const organizerSchema = z.object({
  organizerName: optionalTrimmedText,
  organizerEmail: optionalEmail,
  organizerPhone: optionalTrimmedText,
  organizerWebsite: optionalUrl,
});

const mediaSchema = z.object({
  coverImage: optionalUrl,
  gallery: z.array(z.string().trim().url("Gallery images must be valid URLs")).default([]),
  promoVideoUrl: optionalUrl,
});

const policiesSchema = z.object({
  refundPolicy: optionalTrimmedText,
  cancellationPolicy: optionalTrimmedText,
  transferAllowed: z.boolean().default(true),
  specialInstructions: optionalTrimmedText,
});

const visibilitySchema = z.object({
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).default("PUBLIC"),
  slug: optionalTrimmedText,
});

export const eventDetailsSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  tagline: optionalTrimmedText,
  description: z.string().trim().min(1, "Description is required"),
  category: optionalTrimmedText,
  tags: z.array(z.string().trim().min(1).max(30)).default([]),
  location: z.discriminatedUnion("type", [physicalLocationSchema, onlineLocationSchema]),
  schedule: scheduleSchema,
  organizer: organizerSchema,
  media: mediaSchema,
  policies: policiesSchema,
  visibility: visibilitySchema,
});

const publishableDetailsSchema = eventDetailsSchema.safeExtend({
  schedule: publishableScheduleSchema,
});

const ticketClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Ticket name is required"),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  quantity: z.coerce.number().int().min(1, "Quantity must be a positive integer"),
  type: z.enum(["general", "assigned_seat", "table"]),
});

const layoutSchema = z.object({
  seatingConfig: z.unknown(),
  seatState: z.unknown().optional(),
  summary: z.unknown().optional(),
}).partial().optional();

const ticketMappingSchema = z.object({
  ticketClassId: z.string().min(1),
  targetId: z.string().min(1),
});

export const baseEventSchema = z.object({
  venueId: optionalTrimmedText,
  details: eventDetailsSchema.partial(),
  ticketClasses: z.array(ticketClassSchema).default([]),
  layout: layoutSchema,
  mappings: z.array(ticketMappingSchema).default([]),
  meta: z.unknown().optional(),
});

export const publishableEventSchema = z.object({
  venueId: optionalTrimmedText,
  details: publishableDetailsSchema,
  ticketClasses: z.array(ticketClassSchema).min(1, "At least one ticket class is required"),
  layout: layoutSchema,
  mappings: z.array(ticketMappingSchema).default([]),
  meta: z.unknown().optional(),
});

export const sharedEventSchema = publishableEventSchema;
