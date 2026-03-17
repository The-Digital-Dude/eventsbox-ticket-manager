"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/src/components/ui/badge";
import {
  buildSeatId,
  buildTableSeatId,
  rowLabel,
} from "@/src/lib/venue-seating";
import type {
  PublicSeatBookingState,
  SeatState,
  SeatingSection,
  VenueSeatingConfig,
} from "@/src/types/venue-seating";

function getSeatTone(status: "AVAILABLE" | "RESERVED" | "BOOKED" | "SELECTED") {
  if (status === "BOOKED") {
    return "border-red-300 bg-red-200 text-red-900";
  }
  if (status === "RESERVED") {
    return "border-amber-300 bg-amber-200 text-amber-900";
  }
  if (status === "SELECTED") {
    return "border-sky-500 bg-sky-300 text-sky-950";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function SeatCell({
  seatId,
  label,
  state,
  selected,
  onToggle,
  style,
}: {
  seatId: string;
  label: string;
  state?: PublicSeatBookingState;
  selected: boolean;
  onToggle?: (seatId: string) => void;
  style?: CSSProperties;
}) {
  const status = selected ? "SELECTED" : (state?.status ?? "AVAILABLE");
  const disabled = status === "BOOKED" || status === "RESERVED";

  return (
    <button
      type="button"
      disabled={!onToggle || disabled}
      onClick={() => onToggle?.(seatId)}
      title={state?.seatLabel ?? label}
      className={`grid place-items-center rounded-md border text-[10px] transition ${getSeatTone(status)} ${
        onToggle && !disabled ? "cursor-pointer hover:scale-[1.03]" : "cursor-default"
      } disabled:opacity-100`}
      style={style}
    >
      {label}
    </button>
  );
}

function TableSeat({
  seatId,
  label,
  state,
  selected,
  onToggle,
  style,
}: {
  seatId: string;
  label: string;
  state?: PublicSeatBookingState;
  selected: boolean;
  onToggle?: (seatId: string) => void;
  style?: CSSProperties;
}) {
  const status = selected ? "SELECTED" : (state?.status ?? "AVAILABLE");
  const disabled = status === "BOOKED" || status === "RESERVED";

  return (
    <button
      type="button"
      disabled={!onToggle || disabled}
      onClick={() => onToggle?.(seatId)}
      title={state?.seatLabel ?? label}
      className={`absolute grid place-items-center rounded-full border text-[10px] transition ${getSeatTone(status)} ${
        onToggle && !disabled ? "cursor-pointer hover:scale-[1.03]" : "cursor-default"
      } disabled:opacity-100`}
      style={style}
    >
      {label}
    </button>
  );
}

function buildSectionClass(compact: boolean) {
  return compact
    ? "rounded-xl border border-neutral-200 bg-white p-3"
    : "rounded-2xl border border-neutral-200 bg-white p-4";
}

function renderTableSection(
  section: SeatingSection,
  seatState: Record<string, SeatState> | null | undefined,
  bookingStates: Record<string, PublicSeatBookingState>,
  selectedSeatIds: string[],
  onSeatToggle?: (seatId: string) => void,
  compact = false,
) {
  const size = compact ? 58 : 90;
  const seatSize = compact ? 10 : 16;
  const radius = compact ? 22 : 36;
  const tableCount = section.tableConfig ? section.tableConfig.rows * section.tableConfig.columns : 0;

  return (
    <div
      className="grid justify-center gap-3"
      style={{ gridTemplateColumns: `repeat(${section.tableConfig?.columns ?? 1}, ${size}px)` }}
    >
      {Array.from({ length: tableCount }).map((_, idx) => {
        const tableIndex = idx + 1;
        return (
          <div key={`${section.id}-table-${tableIndex}`} className="relative" style={{ width: size, height: size }}>
            <div className="absolute rounded-full border border-neutral-300 bg-neutral-100" style={{ inset: compact ? 14 : 20 }} />
            {Array.from({ length: section.tableConfig?.seatsPerTable ?? 0 }).map((_, seatIdx) => {
              const angle = (2 * Math.PI * seatIdx) / (section.tableConfig?.seatsPerTable ?? 1);
              const x = size / 2 + radius * Math.cos(angle) - seatSize / 2;
              const y = size / 2 + radius * Math.sin(angle) - seatSize / 2;
              const seatId = buildTableSeatId(section, tableIndex, seatIdx + 1);
              if (seatState?.[seatId]?.deleted) {
                return null;
              }

              return (
                <TableSeat
                  key={seatId}
                  seatId={seatId}
                  label={String(seatIdx + 1)}
                  state={bookingStates[seatId]}
                  selected={selectedSeatIds.includes(seatId)}
                  onToggle={onSeatToggle}
                  style={{ width: seatSize, height: seatSize, left: x, top: y }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderSeatRows(
  section: SeatingSection,
  seatState: Record<string, SeatState> | null | undefined,
  bookingStates: Record<string, PublicSeatBookingState>,
  selectedSeatIds: string[],
  onSeatToggle?: (seatId: string) => void,
) {
  return (
    <div className="overflow-x-auto rounded-xl pb-2">
      <div className="flex min-w-max gap-3">
        {section.columns?.map((column, columnIndex) => {
          const offsetBefore = (section.columns ?? [])
            .slice(0, columnIndex)
            .reduce((sum, entry) => sum + entry.seats, 0);

          return (
            <div
              key={`${section.id}-col-${column.index}`}
              className="flex flex-col gap-1 rounded-lg border border-neutral-100 bg-neutral-50 p-2"
            >
              <p className="mb-1 text-center text-[10px] font-medium text-neutral-400 uppercase tracking-wide">
                Col {columnIndex + 1}
              </p>
              {Array.from({ length: column.rows }).map((_, rowIdx) => {
                const rLabel = rowLabel(section.rowStart + rowIdx + 1);
                return (
                  <div key={`${section.id}-${column.index}-${rowIdx}`} className="flex items-center gap-1">
                    <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-md bg-neutral-900 px-1.5 text-[10px] font-semibold text-white">
                      {rLabel}
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: column.seats }).map((_, seatIdx) => {
                        const seatNo = offsetBefore + seatIdx + 1;
                        const seatId = buildSeatId(section, rLabel, seatNo);
                        if (seatState?.[seatId]?.deleted) {
                          return null;
                        }

                        return (
                          <SeatCell
                            key={seatId}
                            seatId={seatId}
                            label={String(seatNo)}
                            state={bookingStates[seatId]}
                            selected={selectedSeatIds.includes(seatId)}
                            onToggle={onSeatToggle}
                            style={{
                              width: 24,
                              height: 24,
                              transform: `translateX(${seatState?.[seatId]?.offset ?? 0}px)`,
                            }}
                          />
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
    </div>
  );
}

export function SeatMapLive({
  config,
  seatState,
  bookingStates,
  selectedSeatIds,
  onSeatToggle,
  compact = false,
}: {
  config: VenueSeatingConfig;
  seatState?: Record<string, SeatState> | null;
  bookingStates: Record<string, PublicSeatBookingState>;
  selectedSeatIds: string[];
  onSeatToggle?: (seatId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>Sections: {config.summary.sectionCount}</Badge>
        <Badge>Total Seats: {config.summary.totalSeats}</Badge>
        <Badge>Total Tables: {config.summary.totalTables}</Badge>
        <Badge className="border-transparent bg-emerald-100 text-emerald-700">Available</Badge>
        <Badge className="border-transparent bg-red-100 text-red-700">Booked</Badge>
        <Badge className="border-transparent bg-amber-100 text-amber-700">Reserved</Badge>
        {selectedSeatIds.length > 0 ? (
          <Badge className="border-transparent bg-sky-100 text-sky-700">Selected</Badge>
        ) : null}
      </div>

      {config.sections.map((section) => (
        <div key={section.id} className={buildSectionClass(compact)}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">{section.name}</p>
            <Badge className="text-xs">{section.mapType === "table" ? "TABLES" : "SEATS"}</Badge>
          </div>

          {section.mapType === "seats" && (
            <div className="mb-3 flex items-center justify-center">
              <div className="w-2/3 rounded-md border border-neutral-300 bg-neutral-100 py-1 text-center text-[11px] font-medium text-neutral-500 tracking-widest uppercase">
                Stage
              </div>
            </div>
          )}

          {section.mapType === "table" && section.tableConfig
            ? renderTableSection(
                section,
                seatState,
                bookingStates,
                selectedSeatIds,
                onSeatToggle,
                compact,
              )
            : renderSeatRows(
                section,
                seatState,
                bookingStates,
                selectedSeatIds,
                onSeatToggle,
              )}
        </div>
      ))}
    </div>
  );
}
