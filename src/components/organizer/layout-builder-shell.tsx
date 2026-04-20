"use client";

import { SeatMapBuilder } from "@/src/components/shared/seat-map-builder";
import { Button } from "@/src/components/ui/button";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

type SavePayload = {
  seatingConfig: VenueSeatingConfig;
  seatState?: Record<string, SeatState>;
  summary: { totalSeats: number; totalTables: number; sectionCount: number };
};

export function LayoutBuilderShell({
  title,
  description,
  initialConfig,
  initialSeatState,
  saveLabel,
  onSave,
  backLabel,
  onBack,
}: {
  title: string;
  description: string;
  initialConfig?: VenueSeatingConfig | null;
  initialSeatState?: Record<string, SeatState> | null;
  saveLabel: string;
  onSave: (payload: SavePayload) => Promise<void>;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </div>

      <SeatMapBuilder
        initialConfig={initialConfig ?? null}
        initialSeatState={initialSeatState ?? null}
        saveLabel={saveLabel}
        onSave={onSave}
      />

      {onBack ? (
        <div className="mt-4">
          <Button variant="outline" onClick={onBack}>
            {backLabel ?? "Back"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
