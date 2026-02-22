"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import type { SeatState, SeatingColumn, SeatingMapType, SeatingSection, VenueSeatingConfig } from "@/src/types/venue-seating";
import { computeSeatingSummary } from "@/src/lib/validators/venue-seating";

const SECTION_NAME_OPTIONS = ["VIP", "Premium", "Balcony", "General"];

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

function calcSummary(sections: SeatingSection[]) {
  return computeSeatingSummary(
    sections.map((section) => ({
      mapType: section.mapType,
      columns: section.columns,
      tableConfig: section.tableConfig,
    })),
  );
}

type SavePayload = {
  seatingConfig: VenueSeatingConfig;
  seatState?: Record<string, SeatState>;
  summary: { totalSeats: number; totalTables: number; sectionCount: number };
};

export function SeatMapBuilder({
  initialConfig,
  initialSeatState,
  onSave,
  saveLabel,
}: {
  initialConfig?: VenueSeatingConfig | null;
  initialSeatState?: Record<string, SeatState> | null;
  onSave: (payload: SavePayload) => Promise<void>;
  saveLabel: string;
}) {
  const [sectionName, setSectionName] = useState(SECTION_NAME_OPTIONS[0]);
  const [price, setPrice] = useState("7");
  const [mapType, setMapType] = useState<SeatingMapType>("seats");
  const [columnCount, setColumnCount] = useState(3);
  const [columnConfig, setColumnConfig] = useState<Array<{ rows: number; seats: number }>>(
    Array.from({ length: 3 }, () => ({ rows: 6, seats: 8 })),
  );
  const [tableRows, setTableRows] = useState(4);
  const [tableColumns, setTableColumns] = useState(3);
  const [seatsPerTable, setSeatsPerTable] = useState(8);
  const [sections, setSections] = useState<SeatingSection[]>(initialConfig?.sections ?? []);
  const [seatState, setSeatState] = useState<Record<string, SeatState>>(initialSeatState ?? initialConfig?.seatState ?? {});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSectionId, setPreviewSectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dragSeatId, setDragSeatId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragBaseOffset, setDragBaseOffset] = useState(0);

  const summary = useMemo(() => calcSummary(sections), [sections]);

  function normalizeRowStarts(nextSections: SeatingSection[]) {
    let running = 0;
    return nextSections.map((section) => {
      const normalized = { ...section, rowStart: running };
      running += normalized.maxRows;
      return normalized;
    });
  }

  function ensureColumns(count: number) {
    const safeCount = Math.max(1, Math.min(50, count));
    setColumnCount(safeCount);
    setColumnConfig((prev) => {
      const next = [...prev];
      while (next.length < safeCount) {
        next.push({ rows: 6, seats: 8 });
      }
      return next.slice(0, safeCount);
    });
  }

  function toggleSeatSelected(seatId: string) {
    setSeatState((prev) => {
      const current = prev[seatId] ?? {};
      return {
        ...prev,
        [seatId]: { ...current, selected: !current.selected },
      };
    });
  }

  function deleteSelectedSeats() {
    setSeatState((prev) => {
      const next = { ...prev };
      for (const [id, state] of Object.entries(next)) {
        if (state.selected) {
          next[id] = { ...state, selected: false, deleted: true };
        }
      }
      return next;
    });
  }

  function addSection() {
    const rowStart = sections.reduce((sum, section) => sum + section.maxRows, 0);
    const maxRows = mapType === "table" ? tableRows : Math.max(...columnConfig.slice(0, columnCount).map((c) => c.rows));

    const nextSection: SeatingSection = {
      id: crypto.randomUUID(),
      name: sectionName,
      price: Number(price || 7),
      mapType,
      rowStart,
      maxRows,
      columns:
        mapType === "seats"
          ? columnConfig.slice(0, columnCount).map(
              (entry, index): SeatingColumn => ({
                index: index + 1,
                rows: Math.max(1, Math.min(50, Number(entry.rows || 1))),
                seats: Math.max(1, Math.min(100, Number(entry.seats || 1))),
              }),
            )
          : undefined,
      tableConfig:
        mapType === "table"
          ? {
              rows: Math.max(1, Math.min(50, tableRows)),
              columns: Math.max(1, Math.min(50, tableColumns)),
              seatsPerTable: Math.max(2, Math.min(20, seatsPerTable)),
            }
          : undefined,
    };

    setSections((prev) => [...prev, nextSection]);
    setSectionName(SECTION_NAME_OPTIONS[0]);
    setPrice("7");
    toast.success("Section added");
  }

  function deleteSection(sectionId: string) {
    setSections((prev) => {
      const filtered = prev.filter((section) => section.id !== sectionId);
      const normalized = normalizeRowStarts(filtered);

      const prefix = `${sectionId}-`;
      setSeatState((currentSeatState) => {
        const nextSeatState: Record<string, SeatState> = {};
        for (const [seatId, state] of Object.entries(currentSeatState)) {
          if (!seatId.startsWith(prefix)) {
            nextSeatState[seatId] = state;
          }
        }
        return nextSeatState;
      });

      if (previewSectionId === sectionId) {
        setPreviewSectionId(normalized[0]?.id ?? null);
      }

      return normalized;
    });
    toast.success("Section deleted");
  }

  function openPreview(sectionId: string) {
    setPreviewSectionId(sectionId);
    setIsPreviewOpen(true);
  }

  async function handleSave() {
    if (sections.length === 0) {
      toast.error("Please add at least one seating section");
      return;
    }

    const seatingConfig: VenueSeatingConfig = {
      mapType: sections[sections.length - 1]?.mapType ?? "seats",
      sections,
      seatState,
      summary,
      schemaVersion: 1,
    };

    setIsSaving(true);
    try {
      await onSave({ seatingConfig, seatState, summary });
      toast.success("Seating configuration saved");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedSection = sections.find((section) => section.id === previewSectionId) ?? null;

  function renderSection(section: SeatingSection, compact = false) {
    const blockClass = compact
      ? "rounded-xl border border-neutral-200 bg-white p-3"
      : "rounded-2xl border border-neutral-200 bg-white p-4";

    return (
      <div key={section.id} className={blockClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-900">{section.name}</p>
          <div className="flex items-center gap-2">
            {!compact ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => deleteSection(section.id)}
                className="h-7 px-2 text-xs"
              >
                Delete Section
              </Button>
            ) : null}
            <Badge>{section.mapType.toUpperCase()}</Badge>
          </div>
        </div>

        {section.mapType === "table" && section.tableConfig ? (
          <div
            className="grid justify-center gap-3"
            style={{ gridTemplateColumns: `repeat(${section.tableConfig.columns}, ${compact ? 58 : 90}px)` }}
          >
            {Array.from({ length: section.tableConfig.rows * section.tableConfig.columns }).map((_, idx) => {
              const tableIndex = idx + 1;
              const size = compact ? 58 : 90;
              const seatSize = compact ? 10 : 16;
              const radius = compact ? 22 : 36;
              return (
                <div key={`${section.id}-table-${tableIndex}`} className="relative" style={{ width: size, height: size }}>
                  <div
                    className="absolute rounded-full border border-neutral-300 bg-neutral-100"
                    style={{ inset: compact ? 14 : 20 }}
                  />
                  {Array.from({ length: section.tableConfig!.seatsPerTable }).map((_, seatIdx) => {
                    const angle = (2 * Math.PI * seatIdx) / section.tableConfig!.seatsPerTable;
                    const x = size / 2 + radius * Math.cos(angle) - seatSize / 2;
                    const y = size / 2 + radius * Math.sin(angle) - seatSize / 2;
                    const seatId = buildTableSeatId(section, tableIndex, seatIdx + 1);
                    const state = seatState[seatId] ?? {};
                    return (
                      <button
                        key={seatId}
                        type="button"
                        onClick={() => !compact && toggleSeatSelected(seatId)}
                        className={`absolute grid place-items-center rounded-full border text-[10px] ${
                          state.deleted
                            ? "invisible"
                            : state.selected
                              ? "border-emerald-700 bg-emerald-300"
                              : "border-neutral-300 bg-neutral-50"
                        }`}
                        style={{ width: seatSize, height: seatSize, left: x, top: y }}
                      >
                        {seatIdx + 1}
                      </button>
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
                        <span className="inline-flex h-6 min-w-7 items-center justify-center rounded-md bg-neutral-900 px-2 text-xs text-white">
                          {rLabel}
                        </span>
                        <div className="flex gap-1">
                          {Array.from({ length: column.seats }).map((_, seatIdx) => {
                            const seatNo = offsetBefore + seatIdx + 1;
                            const seatId = buildSeatId(section, rLabel, seatNo);
                            const state = seatState[seatId] ?? {};
                            const offset = state.offset ?? 0;
                            return (
                              <button
                                key={seatId}
                                type="button"
                                onClick={() => !compact && toggleSeatSelected(seatId)}
                                onPointerDown={(event) => {
                                  if (compact || !state.selected || state.deleted) return;
                                  setDragSeatId(seatId);
                                  setDragStartX(event.clientX);
                                  setDragBaseOffset(offset);
                                }}
                                onPointerMove={(event) => {
                                  if (compact || dragSeatId !== seatId) return;
                                  const delta = event.clientX - dragStartX;
                                  setSeatState((prev) => ({
                                    ...prev,
                                    [seatId]: { ...(prev[seatId] ?? {}), offset: Math.max(-500, Math.min(500, dragBaseOffset + delta)) },
                                  }));
                                }}
                                onPointerUp={() => {
                                  if (dragSeatId === seatId) setDragSeatId(null);
                                }}
                                className={`grid h-6 w-6 place-items-center rounded-md border text-[10px] transition ${
                                  state.deleted
                                    ? "invisible"
                                    : state.selected
                                      ? "border-emerald-700 bg-emerald-300"
                                      : "border-neutral-300 bg-neutral-50"
                                }`}
                                style={{ transform: `translateX(${offset}px)` }}
                              >
                                {seatNo}
                              </button>
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
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="mb-4 grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Section Name</Label>
            <select
              className="app-select"
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
            >
              {SECTION_NAME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Price</Label>
            <Input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              onWheel={(event) => event.currentTarget.blur()}
              type="number"
              min={0}
              step="0.01"
              placeholder="7.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Map Type</Label>
            <select
              className="app-select"
              value={mapType}
              onChange={(event) => setMapType(event.target.value as SeatingMapType)}
            >
              <option value="seats">Seats</option>
              <option value="table">Table</option>
            </select>
          </div>
        </div>

        {mapType === "seats" ? (
          <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="max-w-xs space-y-2">
              <Label>Number of Columns</Label>
              <Input type="number" min={1} max={50} value={columnCount} onChange={(event) => ensureColumns(Number(event.target.value || 1))} />
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: columnCount }).map((_, idx) => (
                <div key={`cfg-col-${idx}`} className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3">
                  <p className="text-sm font-medium">Column {idx + 1}</p>
                  <div className="space-y-2">
                    <Label>Rows</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={columnConfig[idx]?.rows ?? 6}
                      onChange={(event) => {
                        const value = Number(event.target.value || 1);
                        setColumnConfig((prev) => {
                          const next = [...prev];
                          next[idx] = { ...(next[idx] ?? { rows: 6, seats: 8 }), rows: value };
                          return next;
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Seats / row</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={columnConfig[idx]?.seats ?? 8}
                      onChange={(event) => {
                        const value = Number(event.target.value || 1);
                        setColumnConfig((prev) => {
                          const next = [...prev];
                          next[idx] = { ...(next[idx] ?? { rows: 6, seats: 8 }), seats: value };
                          return next;
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Table Rows</Label><Input type="number" min={1} max={50} value={tableRows} onChange={(event) => setTableRows(Number(event.target.value || 1))} /></div>
            <div className="space-y-2"><Label>Table Columns</Label><Input type="number" min={1} max={50} value={tableColumns} onChange={(event) => setTableColumns(Number(event.target.value || 1))} /></div>
            <div className="space-y-2"><Label>Seats / Table</Label><Input type="number" min={2} max={20} value={seatsPerTable} onChange={(event) => setSeatsPerTable(Number(event.target.value || 2))} /></div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={addSection}>Add Section</Button>
          <Button type="button" variant="outline" onClick={deleteSelectedSeats}>Delete Selected Seats</Button>
          <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)}>Preview Sections</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving..." : saveLabel}</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge>Sections: {summary.sectionCount}</Badge>
          <Badge>Total Seats: {summary.totalSeats}</Badge>
          <Badge>Total Tables: {summary.totalTables}</Badge>
        </div>

        {sections.length === 0 ? <p className="text-sm text-neutral-600">No sections configured yet.</p> : <div className="space-y-4">{sections.map((section) => renderSection(section))}</div>}
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Section Preview</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {sections.map((section) => (
                <button
                  key={`mini-${section.id}`}
                  type="button"
                  onClick={() => openPreview(section.id)}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left hover:bg-neutral-100"
                >
                  <p className="font-medium">{section.name}</p>
                  <p className="text-xs text-neutral-600">{section.mapType.toUpperCase()} map</p>
                </button>
              ))}
            </div>
            {selectedSection ? <div className="rounded-xl border border-neutral-200 p-3">{renderSection(selectedSection, true)}</div> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
