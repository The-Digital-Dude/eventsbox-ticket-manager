'use client';

import { LayoutBuilderShell } from "@/src/components/organizer/layout-builder-shell";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

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
};

export function LayoutSetupStep({ initialData, layoutType, onNext, onPrevious }: LayoutSetupStepProps) {

  const description = `Configure the ${layoutType} layout for this event. You can create sections for assigned seats, tables, or a mix of both.`;

  return (
    <div>
      <LayoutBuilderShell
        title="Layout Setup"
        description={description}
        initialConfig={initialData?.seatingConfig ?? null}
        initialSeatState={initialData?.seatState ?? null}
        saveLabel="Save & Continue"
        onSave={onNext}
        backLabel="Previous Step"
        onBack={onPrevious}
      />
    </div>
  );
}
