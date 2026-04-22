"use client";

import type { RelationalSeatingLayout } from "@/src/types/event-draft";

type BookingState = {
  status?: "AVAILABLE" | "RESERVED" | "BOOKED";
  seatLabel?: string | null;
  expiresAt?: string | null;
};

type SeatMapLiveProps = {
  config: RelationalSeatingLayout;
  bookingStates: Record<string, BookingState>;
  selectedSeatIds: string[];
  onSeatToggle: (seatId: string) => void;
};

function seatIdFor(sectionName: string, index: number) {
  return `${sectionName}-A${index}`;
}

function seatLabelFor(sectionName: string, index: number) {
  return `${sectionName} A${index}`;
}

function statusClasses(status: BookingState["status"], selected: boolean) {
  if (status === "BOOKED") return "border-neutral-300 bg-neutral-200 text-neutral-400 cursor-not-allowed";
  if (status === "RESERVED") return "border-amber-300 bg-amber-100 text-amber-700 cursor-not-allowed";
  if (selected) return "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white";
  return "border-neutral-200 bg-white text-neutral-700 hover:border-[var(--theme-accent)] hover:bg-[rgb(var(--theme-accent-rgb)/0.06)]";
}

export function SeatMapLive({
  config,
  bookingStates,
  selectedSeatIds,
  onSeatToggle,
}: SeatMapLiveProps) {
  const sections = config.sections ?? [];

  if (sections.length === 0) {
    return <p className="text-sm text-neutral-500">No seat sections are configured for this event.</p>;
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const capacity = Math.max(0, section.capacity ?? 0);
        const columns = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(Math.max(1, capacity)))));

        return (
          <div key={section.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-900">{section.name}</p>
              <p className="text-xs text-neutral-500">{capacity} seats</p>
            </div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(2.25rem, 1fr))` }}
            >
              {Array.from({ length: capacity }, (_, index) => {
                const seatNumber = index + 1;
                const seatId = seatIdFor(section.name, seatNumber);
                const bookingState = bookingStates[seatId] ?? { status: "AVAILABLE" as const };
                const status = bookingState.status ?? "AVAILABLE";
                const selected = selectedSeatIds.includes(seatId);
                const disabled = status === "BOOKED" || status === "RESERVED";

                return (
                  <button
                    key={seatId}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSeatToggle(seatId)}
                    className={`h-10 rounded-lg border text-xs font-semibold transition ${statusClasses(status, selected)}`}
                    title={bookingState.seatLabel ?? seatLabelFor(section.name, seatNumber)}
                  >
                    A{seatNumber}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>White: available</span>
        <span>Accent: selected</span>
        <span>Amber: held</span>
        <span>Grey: booked</span>
      </div>
    </div>
  );
}
