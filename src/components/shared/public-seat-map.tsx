"use client";

import { Armchair } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { formatCurrency } from "@/src/lib/currency";

export type PublicSeatMapSeatStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";

export type PublicSeatMapSeat = {
  id: string;
  sectionId: string;
  rowId: string;
  seatLabel: string;
  status: PublicSeatMapSeatStatus;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  price: number;
};

export type PublicSeatMapRow = {
  id: string;
  label: string;
  sortOrder: number;
  seats: PublicSeatMapSeat[];
};

export type PublicSeatMapSection = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  rows: PublicSeatMapRow[];
};

const seatClasses: Record<PublicSeatMapSeatStatus | "SELECTED", string> = {
  AVAILABLE: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
  RESERVED: "border-amber-300 bg-amber-100 text-amber-900",
  SOLD: "border-red-300 bg-red-100 text-red-900",
  BLOCKED: "border-neutral-300 bg-neutral-200 text-neutral-600",
  SELECTED: "border-sky-500 bg-sky-200 text-sky-950 ring-2 ring-sky-300",
};

function shortSeatLabel(label: string) {
  const match = label.match(/(\d+)$/);
  return match?.[1] ?? label.slice(-3);
}

export function PublicSeatMap({
  sections,
  selectedSeatIds,
  onSelectionChange,
  currency,
  disabled = false,
}: {
  sections: PublicSeatMapSection[];
  selectedSeatIds: string[];
  onSelectionChange: (seatIds: string[]) => void;
  currency: string;
  disabled?: boolean;
}) {
  const seats = sections.flatMap((section) => section.rows.flatMap((row) => row.seats));
  const selectedSeats = seats.filter((seat) => selectedSeatIds.includes(seat.id));
  const total = selectedSeats.reduce((sum, seat) => sum + Number(seat.price ?? 0), 0);

  function toggleSeat(seat: PublicSeatMapSeat) {
    if (disabled || seat.status !== "AVAILABLE") return;
    if (selectedSeatIds.includes(seat.id)) {
      onSelectionChange(selectedSeatIds.filter((seatId) => seatId !== seat.id));
      return;
    }
    onSelectionChange([...selectedSeatIds, seat.id]);
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-500">
        Seating is not available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className="border-transparent bg-emerald-100 text-emerald-700">Available</Badge>
        <Badge className="border-transparent bg-amber-100 text-amber-700">Reserved</Badge>
        <Badge className="border-transparent bg-red-100 text-red-700">Sold</Badge>
        <Badge className="border-transparent bg-neutral-200 text-neutral-700">Blocked</Badge>
        <Badge className="border-transparent bg-sky-100 text-sky-700">Selected</Badge>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: section.color }}
                />
                <p className="text-sm font-semibold text-neutral-900">{section.name}</p>
              </div>
              <Badge>{section.rows.reduce((sum, row) => sum + row.seats.length, 0)} seats</Badge>
            </div>

            <div className="mb-4 flex items-center justify-center">
              <div className="w-2/3 rounded-md border border-neutral-300 bg-neutral-100 py-1 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Stage
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="min-w-max space-y-2">
                {section.rows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <span className="flex h-8 min-w-9 items-center justify-center rounded-md bg-neutral-900 px-2 text-xs font-semibold text-white">
                      {row.label}
                    </span>
                    <div className="flex gap-1.5">
                      {row.seats.map((seat) => {
                        const selected = selectedSeatIds.includes(seat.id);
                        const tone = selected ? "SELECTED" : seat.status;
                        const selectable = seat.status === "AVAILABLE" && !disabled;
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            disabled={!selectable}
                            onClick={() => toggleSeat(seat)}
                            title={`${seat.seatLabel} · ${seat.status.toLowerCase()} · ${formatCurrency(Number(seat.price), currency)}`}
                            className={`grid h-8 w-8 place-items-center rounded-md border text-[10px] font-medium transition ${seatClasses[tone]} ${
                              selectable ? "hover:scale-[1.03]" : "cursor-not-allowed opacity-80"
                            }`}
                          >
                            {shortSeatLabel(seat.seatLabel)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Armchair className="h-4 w-4 text-[var(--theme-accent)]" />
            <p className="text-sm font-semibold text-neutral-900">
              {selectedSeats.length} selected
            </p>
          </div>
          {selectedSeats.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onSelectionChange([])} disabled={disabled}>
              Clear
            </Button>
          ) : null}
        </div>
        {selectedSeats.length > 0 ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSeats.map((seat) => (
                <Badge key={seat.id} className="border-transparent bg-sky-100 text-sky-700">
                  {seat.seatLabel}
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-neutral-500">Seat total</span>
              <span className="font-semibold text-neutral-900">{formatCurrency(total, currency)}</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">Select available seats from the map.</p>
        )}
      </div>
    </div>
  );
}
