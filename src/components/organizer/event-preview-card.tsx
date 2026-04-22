'use client';

import { EventDetailsFormData } from "@/src/types/event-draft";
import { Badge } from "@/src/components/ui/badge";

interface EventPreviewCardProps {
  details: Partial<EventDetailsFormData>;
}

export function EventPreviewCard({ details }: EventPreviewCardProps) {
  const coverImage = details.media?.heroImage;
  const title = details.title || "Your Event Title";
  const date = details.schedule?.startAt ? new Date(details.schedule.startAt).toLocaleDateString() : "Event Date";
  const venue = details.location?.venueName || "Venue Name";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm sticky top-20">
      <div className="h-40 bg-neutral-100 rounded-t-2xl flex items-center justify-center">
        {coverImage ? (
          <img src={coverImage} alt={title} className="h-full w-full object-cover rounded-t-2xl" />
        ) : (
          <p className="text-neutral-500">Cover Image</p>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="text-sm text-neutral-600 mt-1">{date}</p>
        <p className="text-sm text-neutral-600">{venue}</p>
        <div className="mt-4 flex justify-between items-center">
          <Badge>Draft</Badge>
          <p className="text-xs text-neutral-500">Saved</p>
        </div>
      </div>
    </div>
  );
}
