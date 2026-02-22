"use client";

import { Badge } from "@/src/components/ui/badge";
import type { SeatState, SeatingSection, VenueSeatingConfig } from "@/src/types/venue-seating";

function rowLabel(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index <= alphabet.length) {
    return alphabet[index - 1];
  }
  const first = Math.floor((index - 1) / alphabet.length) - 1;
  const second = (index - 1) % alphabet.length;
  return `${alphabet[first]}${alphabet[second]}`;
}

function buildSeatId(section: SeatingSection, rowName: string, seatNo: number) {
  return `${section.name || section.id}-${rowName}${seatNo}`;
}

function buildTableSeatId(section: SeatingSection, tableIndex: number, seatIndex: number) {
  return `${section.name || section.id}-T${tableIndex}-S${seatIndex}`;
}

export function SeatMapReadOnly({ config, seatState, compact = false }: { config: VenueSeatingConfig; seatState?: Record<string, SeatState> | null; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge>Sections: {config.summary.sectionCount}</Badge>
        <Badge>Total Seats: {config.summary.totalSeats}</Badge>
        <Badge>Total Tables: {config.summary.totalTables}</Badge>
      </div>

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
                        return (
                          <div
                            key={seatId}
                            className={`absolute grid place-items-center rounded-full border text-[10px] ${
                              state.deleted ? "invisible" : state.selected ? "border-emerald-700 bg-emerald-300" : "border-neutral-300 bg-neutral-50"
                            }`}
                            style={{ width: seatSize, height: seatSize, left: x, top: y }}
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
                                const offset = state.offset ?? 0;
                                return (
                                  <div
                                    key={seatId}
                                    className={`grid h-6 w-6 place-items-center rounded-md border text-[10px] ${
                                      state.deleted ? "invisible" : state.selected ? "border-emerald-700 bg-emerald-300" : "border-neutral-300 bg-neutral-50"
                                    }`}
                                    style={{ transform: `translateX(${offset}px)` }}
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
