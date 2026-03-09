"use client";

import { Badge } from "@/src/components/ui/badge";
import { buildSeatId, buildTableSeatId, rowLabel } from "@/src/lib/venue-seating";
import type { SeatAvailabilityStatus, SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

function getSeatTone(
  state: SeatState,
  availability?: SeatAvailabilityStatus,
) {
  if (availability === "booked") {
    return "border-red-300 bg-red-100 text-red-800";
  }

  if (availability === "reserved") {
    return "border-amber-300 bg-amber-100 text-amber-800";
  }

  if (state.selected) {
    return "border-emerald-700 bg-emerald-300 text-emerald-950";
  }

  return "border-neutral-300 bg-neutral-50 text-neutral-700";
}

export function SeatMapReadOnly({
  config,
  seatState,
  seatAvailability,
  compact = false,
  showLegend = Boolean(seatAvailability),
  onSeatClick,
}: {
  config: VenueSeatingConfig;
  seatState?: Record<string, SeatState> | null;
  seatAvailability?: Record<string, SeatAvailabilityStatus> | null;
  compact?: boolean;
  showLegend?: boolean;
  onSeatClick?: (seatId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge>Sections: {config.summary.sectionCount}</Badge>
        <Badge>Total Seats: {config.summary.totalSeats}</Badge>
        <Badge>Total Tables: {config.summary.totalTables}</Badge>
      </div>

      {showLegend ? (
        <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-neutral-300 bg-neutral-50" />
            Available
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-amber-300 bg-amber-100" />
            Reserved
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-red-300 bg-red-100" />
            Booked
          </span>
        </div>
      ) : null}

      {config.sections.map((section) => {
        const blockClass = compact
          ? "rounded-xl border border-neutral-200 bg-white p-3"
          : "rounded-2xl border border-neutral-200 bg-white p-4";

        return (
          <div key={section.id} className={blockClass}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">{section.name}</p>
              <Badge>{section.mapType.toUpperCase()}</Badge>
            </div>

            {section.mapType === "table" && section.tableConfig ? (
              <div className="grid justify-center gap-3" style={{ gridTemplateColumns: `repeat(${section.tableConfig.columns}, ${compact ? 58 : 90}px)` }}>
                {Array.from({ length: section.tableConfig.rows * section.tableConfig.columns }).map((_, idx) => {
                  const tableIndex = idx + 1;
                  const size = compact ? 58 : 90;
                  const seatSize = compact ? 10 : 16;
                  const radius = compact ? 22 : 36;
                  return (
                    <div key={`${section.id}-table-${tableIndex}`} className="relative" style={{ width: size, height: size }}>
                      <div className="absolute rounded-full border border-neutral-300 bg-neutral-100" style={{ inset: compact ? 14 : 20 }} />
                      {Array.from({ length: section.tableConfig!.seatsPerTable }).map((_, seatIdx) => {
                        const angle = (2 * Math.PI * seatIdx) / section.tableConfig!.seatsPerTable;
                        const x = size / 2 + radius * Math.cos(angle) - seatSize / 2;
                        const y = size / 2 + radius * Math.sin(angle) - seatSize / 2;
                        const seatId = buildTableSeatId(section, tableIndex, seatIdx + 1);
                        const state = seatState?.[seatId] ?? {};
                        const availability = seatAvailability?.[seatId];
                        const isClickable = Boolean(onSeatClick) && !state.deleted && availability !== "booked" && availability !== "reserved";
                        return (
                          <div
                            key={seatId}
                            className={`absolute grid place-items-center rounded-full border text-[10px] ${
                              state.deleted ? "invisible" : getSeatTone(state, availability)
                            } ${isClickable ? "cursor-pointer transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.35)]" : ""}`}
                            style={{ width: seatSize, height: seatSize, left: x, top: y }}
                            onClick={isClickable ? () => onSeatClick?.(seatId) : undefined}
                            onKeyDown={isClickable ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onSeatClick?.(seatId);
                              }
                            } : undefined}
                            role={isClickable ? "button" : undefined}
                            tabIndex={isClickable ? 0 : undefined}
                          >
                            {seatIdx + 1}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 overflow-x-auto pb-2">
                {section.columns?.map((column, cIndex) => {
                  const offsetBefore = (section.columns ?? []).slice(0, cIndex).reduce((sum, c) => sum + c.seats, 0);
                  return (
                    <div key={`${section.id}-col-${column.index}`} className="space-y-2">
                      {Array.from({ length: column.rows }).map((_, rowIdx) => {
                        const rLabel = rowLabel(section.rowStart + rowIdx + 1);
                        return (
                          <div key={`${section.id}-${column.index}-${rowIdx}`} className="flex items-center gap-2">
                            <span className="inline-flex h-6 min-w-7 items-center justify-center rounded-md bg-neutral-900 px-2 text-xs text-white">{rLabel}</span>
                            <div className="flex gap-1">
                              {Array.from({ length: column.seats }).map((_, seatIdx) => {
                                const seatNo = offsetBefore + seatIdx + 1;
                                const seatId = buildSeatId(section, rLabel, seatNo);
                                const state = seatState?.[seatId] ?? {};
                                const availability = seatAvailability?.[seatId];
                                const offset = state.offset ?? 0;
                                const isClickable = Boolean(onSeatClick) && !state.deleted && availability !== "booked" && availability !== "reserved";
                                return (
                                  <div
                                    key={seatId}
                                    className={`grid h-6 w-6 place-items-center rounded-md border text-[10px] ${
                                      state.deleted ? "invisible" : getSeatTone(state, availability)
                                    } ${isClickable ? "cursor-pointer transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.35)]" : ""}`}
                                    style={{ transform: `translateX(${offset}px)` }}
                                    onClick={isClickable ? () => onSeatClick?.(seatId) : undefined}
                                    onKeyDown={isClickable ? (event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        onSeatClick?.(seatId);
                                      }
                                    } : undefined}
                                    role={isClickable ? "button" : undefined}
                                    tabIndex={isClickable ? 0 : undefined}
                                  >
                                    {seatNo}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
