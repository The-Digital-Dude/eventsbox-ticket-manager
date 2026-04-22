'use client';

import { useEffect, useState } from 'react';
import { LayoutBuilderShell } from "@/src/components/organizer/layout-builder-shell";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";
import { toast } from 'sonner';

import type { EventTicketClass } from "@/src/types/event-draft";

export type LayoutSetupData = {
  seatingConfig: VenueSeatingConfig;
  seatState?: Record<string, SeatState>;
  summary: { totalSeats: number; totalTables: number; sectionCount: number };
};

type LayoutSetupStepProps = {
  initialData?: LayoutSetupData;
  layoutType: 'seating' | 'table' | 'mixed';
  onNext: (data: LayoutSetupData) => void;
  onPrevious: () => void;
  ticketClasses?: EventTicketClass[];
  venueId?: string;
};

export function LayoutSetupStep({ initialData, layoutType, onNext, onPrevious, ticketClasses, venueId }: LayoutSetupStepProps) {
  const [fetchedVenueConfig, setFetchedVenueConfig] = useState<VenueSeatingConfig | null>(null);
  const [loadingVenueConfig, setLoadingVenueConfig] = useState(false);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [summary, setSummary] = useState(initialData?.summary ?? { totalSeats: 0, totalTables: 0, sectionCount: 0 });

  useEffect(() => {
    async function fetchVenueSeating() {
      if (venueId && !initialData?.seatingConfig) {
        setLoadingVenueConfig(true);
        const res = await fetch(`/api/organizer/venues/${venueId}`);
        const payload = await res.json();
        if (res.ok && payload.data?.seatingConfig) {
          setFetchedVenueConfig(payload.data.seatingConfig);
          setVenueName(payload.data.name);
          toast.success(`Loaded layout template from venue: ${payload.data.name}`);
        } else if (!res.ok) {
          toast.error(payload?.error?.message ?? "Failed to load venue seating template.");
        }
        setLoadingVenueConfig(false);
      } else if (initialData?.seatingConfig) {
        // If initialData already has a seatingConfig, clear fetched one
        setFetchedVenueConfig(null);
        setVenueName(null);
      }
    }
    fetchVenueSeating();
  }, [venueId, initialData?.seatingConfig]);

  const description = `Configure the ${layoutType} layout for this event. You can create sections for assigned seats, tables, or a mix of both.`;

  if (loadingVenueConfig) {
    return <div className="p-6">Loading venue seating template...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-3">
        {fetchedVenueConfig && venueName && !initialData?.seatingConfig && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-4">
            We&apos;ve started you with the layout from <strong>{venueName}</strong>. You can customize it for this event without affecting the venue&apos;s template.
          </div>
        )}
        {initialData?.seatingConfig && !fetchedVenueConfig && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            We created an initial layout based on your ticket quantities. You can customize it below.
          </div>
        )}
        <LayoutBuilderShell
          title="Layout Setup"
          description={description}
          initialConfig={initialData?.seatingConfig ?? fetchedVenueConfig ?? null}
          initialSeatState={initialData?.seatState ?? null}
          saveLabel="Save & Continue"
          onSave={onNext}
          backLabel="Previous Step"
          onBack={onPrevious}
          onSummaryChange={setSummary}
          ticketClasses={ticketClasses ?? []}
        />
      </div>
      <div className="md:col-span-1">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sticky top-20">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Live Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600">Sections</dt>
              <dd className="font-medium text-neutral-900">{summary.sectionCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600">Total Tables</dt>
              <dd className="font-medium text-neutral-900">{summary.totalTables}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600">Total Seats</dt>
              <dd className="font-medium text-neutral-900">{summary.totalSeats}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sticky top-20 mt-4">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Tickets to Accommodate</h3>
          {ticketClasses && ticketClasses.length > 0 ? (
            <ul className="space-y-2">
              {ticketClasses.map(tc => (
                <li key={tc.id} className="text-sm text-neutral-700">
                  <span className="font-medium">{tc.name}</span>: {tc.quantity} {tc.type !== 'general' ? `${tc.type} tickets` : 'tickets'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">No layout-dependent tickets defined.</p>
          )}
        </section>
      </div>
    </div>
  );
}
