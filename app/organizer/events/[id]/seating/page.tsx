"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Grid3X3, Plus, Save, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type SeatStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";
type SelectedType = "SECTION" | "ROW" | "SEAT" | "TABLE_ZONE";

type SeatInventory = {
  id: string;
  eventId: string;
  sectionId: string;
  rowId: string;
  seatLabel: string;
  status: SeatStatus;
};

type SeatingRow = {
  id: string;
  sectionId: string;
  label: string;
  sortOrder: number;
  seats: SeatInventory[];
};

type SeatingSection = {
  id: string;
  eventId: string;
  name: string;
  price: number | string | null;
  color: string;
  sortOrder: number;
  rows: SeatingRow[];
  seats: SeatInventory[];
};

type TableZone = {
  id: string;
  eventId: string;
  name: string;
  seatsPerTable: number;
  totalTables: number;
  price: number | string;
  color: string | null;
};

type SeatingPayload = {
  event: { id: string; title: string; mode: string };
  sections: SeatingSection[];
  tableZones: TableZone[];
};

type SelectedItem =
  | { type: "SECTION"; item: SeatingSection }
  | { type: "ROW"; item: SeatingRow; section: SeatingSection }
  | { type: "SEAT"; item: SeatInventory; section: SeatingSection; row: SeatingRow }
  | { type: "TABLE_ZONE"; item: TableZone };

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/affiliate", label: "Affiliate Links" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

const statusClasses: Record<SeatStatus, string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
  RESERVED: "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200",
  SOLD: "border-red-200 bg-red-100 text-red-800 hover:bg-red-200",
  BLOCKED: "border-neutral-300 bg-neutral-200 text-neutral-700 hover:bg-neutral-300",
};

const sectionColors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];

function toFormValue(value: number | string | null | undefined) {
  return value == null ? "" : String(value);
}

function labelForSelection(selected: SelectedItem | null) {
  if (!selected) return "Nothing selected";
  if (selected.type === "SECTION") return `Section: ${selected.item.name}`;
  if (selected.type === "ROW") return `Row: ${selected.section.name} / ${selected.item.label}`;
  if (selected.type === "SEAT") return `Seat: ${selected.item.seatLabel}`;
  return `Table zone: ${selected.item.name}`;
}

export default function SeatingBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SeatingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const [sectionName, setSectionName] = useState("");
  const [sectionPrice, setSectionPrice] = useState("");
  const [sectionColor, setSectionColor] = useState(sectionColors[0]);
  const [sectionSortOrder, setSectionSortOrder] = useState("0");
  const [rowLabel, setRowLabel] = useState("");
  const [rowSortOrder, setRowSortOrder] = useState("0");
  const [tableName, setTableName] = useState("");
  const [tableColor, setTableColor] = useState("#0f766e");
  const [seatsPerTable, setSeatsPerTable] = useState("8");
  const [totalTables, setTotalTables] = useState("10");
  const [tablePrice, setTablePrice] = useState("0");
  const [seatStatus, setSeatStatus] = useState<SeatStatus>("AVAILABLE");
  const [bulkRowCount, setBulkRowCount] = useState("3");
  const [bulkSeatsPerRow, setBulkSeatsPerRow] = useState("10");
  const [bulkRowPrefix, setBulkRowPrefix] = useState("");

  async function load(nextSelected?: { type: SelectedType; id: string }) {
    const res = await fetch(`/api/organizer/events/${id}/seating`);
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (payload?.error?.code === "INVALID_EVENT_MODE") {
        setModeError(payload.error.message);
        return;
      }
      toast.error(payload?.error?.message ?? "Unable to load seating map");
      router.push(`/organizer/events/${id}`);
      return;
    }

    setModeError(null);
    setData(payload.data);

    if (nextSelected) {
      const match = findSelected(payload.data, nextSelected.type, nextSelected.id);
      setSelected(match);
    } else if (selected) {
      const match = findSelected(payload.data, selected.type, selected.item.id);
      setSelected(match);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!selected) return;
    if (selected.type === "SECTION") {
      setSectionName(selected.item.name);
      setSectionPrice(toFormValue(selected.item.price));
      setSectionColor(selected.item.color);
      setSectionSortOrder(String(selected.item.sortOrder));
    }
    if (selected.type === "ROW") {
      setRowLabel(selected.item.label);
      setRowSortOrder(String(selected.item.sortOrder));
    }
    if (selected.type === "SEAT") {
      setSeatStatus(selected.item.status);
    }
    if (selected.type === "TABLE_ZONE") {
      setTableName(selected.item.name);
      setTableColor(selected.item.color ?? "#0f766e");
      setSeatsPerTable(String(selected.item.seatsPerTable));
      setTotalTables(String(selected.item.totalTables));
      setTablePrice(toFormValue(selected.item.price));
    }
  }, [selected]);

  function findSelected(payload: SeatingPayload, type: SelectedType, itemId: string): SelectedItem | null {
    if (type === "SECTION") {
      const section = payload.sections.find((item) => item.id === itemId);
      return section ? { type: "SECTION", item: section } : null;
    }
    if (type === "TABLE_ZONE") {
      const tableZone = payload.tableZones.find((item) => item.id === itemId);
      return tableZone ? { type: "TABLE_ZONE", item: tableZone } : null;
    }
    for (const section of payload.sections) {
      const row = section.rows.find((item) => item.id === itemId);
      if (type === "ROW" && row) return { type: "ROW", item: row, section };
      for (const candidateRow of section.rows) {
        const seat = candidateRow.seats.find((item) => item.id === itemId);
        if (type === "SEAT" && seat) return { type: "SEAT", item: seat, section, row: candidateRow };
      }
    }
    return null;
  }

  const totals = useMemo(() => {
    const seats = data?.sections.flatMap((section) => section.rows.flatMap((row) => row.seats)) ?? [];
    return {
      sections: data?.sections.length ?? 0,
      rows: data?.sections.reduce((sum, section) => sum + section.rows.length, 0) ?? 0,
      seats: seats.length,
      tables: data?.tableZones.reduce((sum, zone) => sum + zone.totalTables, 0) ?? 0,
    };
  }, [data]);

  async function post(body: unknown, success: string, nextSelected?: { type: SelectedType; id?: string }) {
    setSaving(true);
    const res = await fetch(`/api/organizer/events/${id}/seating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to save");
    toast.success(success);
    await load(nextSelected?.id ? { type: nextSelected.type, id: nextSelected.id } : undefined);
    return payload.data;
  }

  async function createSection() {
    const created = await post({
      action: "createSection",
      name: `Section ${(data?.sections.length ?? 0) + 1}`,
      price: null,
      color: sectionColors[(data?.sections.length ?? 0) % sectionColors.length],
      sortOrder: data?.sections.length ?? 0,
    }, "Section added");
    if (created?.id) await load({ type: "SECTION", id: created.id });
  }

  async function createRow(section: SeatingSection) {
    const created = await post({
      action: "createRow",
      sectionId: section.id,
      label: String.fromCharCode(65 + section.rows.length),
      sortOrder: section.rows.length,
    }, "Row added");
    if (created?.id) await load({ type: "ROW", id: created.id });
  }

  async function createTableZone() {
    const created = await post({
      action: "createTableZone",
      name: `Table Zone ${(data?.tableZones.length ?? 0) + 1}`,
      seatsPerTable: 8,
      totalTables: 10,
      price: 0,
      color: "#0f766e",
    }, "Table zone added");
    if (created?.id) await load({ type: "TABLE_ZONE", id: created.id });
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    const body =
      selected.type === "SECTION"
        ? {
            type: "SECTION",
            name: sectionName,
            price: sectionPrice === "" ? null : Number(sectionPrice),
            color: sectionColor,
            sortOrder: Number(sectionSortOrder),
          }
        : selected.type === "ROW"
          ? { type: "ROW", label: rowLabel, sortOrder: Number(rowSortOrder) }
          : selected.type === "SEAT"
            ? { type: "SEAT", status: seatStatus }
            : {
                type: "TABLE_ZONE",
                name: tableName,
                color: tableColor,
                seatsPerTable: Number(seatsPerTable),
                totalTables: Number(totalTables),
                price: Number(tablePrice),
              };

    const res = await fetch(`/api/organizer/events/${id}/seating/${selected.item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to save selection");
    toast.success("Saved");
    await load({ type: selected.type, id: selected.item.id });
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!confirm(`Delete ${labelForSelection(selected)}?`)) return;

    setSaving(true);
    const res = await fetch(`/api/organizer/events/${id}/seating/${selected.item.id}?type=${selected.type}`, {
      method: "DELETE",
    });
    const payload = await res.json();
    setSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to delete selection");
    toast.success("Deleted");
    setSelected(null);
    await load();
  }

  async function bulkGenerateSeats() {
    if (!selected || (selected.type !== "SECTION" && selected.type !== "ROW")) {
      return toast.error("Select a section or row first");
    }

    const section = selected.type === "SECTION" ? selected.item : selected.section;
    await post({
      action: "bulkSeats",
      sectionId: section.id,
      rowId: selected.type === "ROW" ? selected.item.id : undefined,
      rowCount: Number(bulkRowCount),
      seatsPerRow: Number(bulkSeatsPerRow),
      rowPrefix: bulkRowPrefix,
    }, "Seats generated", { type: "SECTION", id: section.id });
  }

  if (loading) {
    return (
      <SidebarLayout role="organizer" title="Organizer" items={nav}>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="h-96 animate-pulse rounded-2xl bg-neutral-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      </SidebarLayout>
    );
  }

  if (modeError) {
    return (
      <SidebarLayout role="organizer" title="Organizer" items={nav}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Seating builder unavailable</h1>
          <p className="mt-2 text-sm">{modeError}</p>
          <Link href={`/organizer/events/${id}`} className="mt-4 inline-block">
            <Button variant="outline">Back to event</Button>
          </Link>
        </div>
      </SidebarLayout>
    );
  }

  if (!data) return null;

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="space-y-5">
        <div className="space-y-1">
          <Link href={`/organizer/events/${id}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
            <ChevronLeft className="h-4 w-4" /> Event setup
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge className="mb-2 border-transparent bg-sky-100 text-sky-700">Reserved seating</Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{data.event.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={createSection} disabled={saving}>
                <Plus className="h-4 w-4" /> Section
              </Button>
              <Button variant="outline" size="sm" onClick={createTableZone} disabled={saving}>
                <Utensils className="h-4 w-4" /> Table Zone
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Sections", totals.sections],
            ["Rows", totals.rows],
            ["Seats", totals.seats],
            ["Tables", totals.tables],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-neutral-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Visual Seating Canvas</h2>
                <p className="text-sm text-neutral-500">Select any section, row, seat, or table zone to edit it.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                {Object.keys(statusClasses).map((status) => (
                  <span key={status} className="inline-flex items-center gap-1">
                    <span className={`h-3 w-3 rounded border ${statusClasses[status as SeatStatus]}`} />
                    {status.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>

            {data.sections.length === 0 && data.tableZones.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
                <Grid3X3 className="mb-3 h-8 w-8 text-neutral-400" />
                <p className="font-medium text-neutral-900">Start with a section or table zone.</p>
                <p className="mt-1 text-sm text-neutral-500">Rows and seats will appear here as you build.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {data.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`rounded-xl border p-4 ${selected?.item.id === section.id ? "border-neutral-900" : "border-[var(--border)]"}`}
                    style={{ boxShadow: `inset 4px 0 0 ${section.color}` }}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelected({ type: "SECTION", item: section })}
                      >
                        <span className="text-base font-semibold text-neutral-900">{section.name}</span>
                        <span className="ml-2 text-xs text-neutral-500">{section.rows.length} rows / {section.seats.length} seats</span>
                        {section.price != null && (
                          <Badge className="ml-2 border-transparent bg-emerald-100 text-emerald-700">
                            ${Number(section.price).toFixed(2)}
                          </Badge>
                        )}
                      </button>
                      <Button size="sm" variant="outline" onClick={() => createRow(section)} disabled={saving}>
                        <Plus className="h-4 w-4" /> Row
                      </Button>
                    </div>

                    {section.rows.length === 0 ? (
                      <p className="rounded-lg bg-neutral-50 px-3 py-4 text-sm text-neutral-500">No rows yet.</p>
                    ) : (
                      <div className="space-y-2 overflow-x-auto pb-1">
                        {section.rows.map((row) => (
                          <div key={row.id} className="flex min-w-max items-center gap-2">
                            <button
                              type="button"
                              className={`h-8 w-12 rounded border text-xs font-semibold ${selected?.item.id === row.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-700"}`}
                              onClick={() => setSelected({ type: "ROW", item: row, section })}
                            >
                              {row.label}
                            </button>
                            <div className="flex gap-1">
                              {row.seats.length === 0 ? (
                                <span className="text-xs text-neutral-400">No seats</span>
                              ) : row.seats.map((seat) => (
                                <button
                                  key={seat.id}
                                  type="button"
                                  title={`${seat.seatLabel} - ${seat.status.toLowerCase()}`}
                                  className={`h-7 w-7 rounded border text-[10px] font-semibold ${statusClasses[seat.status]} ${selected?.item.id === seat.id ? "ring-2 ring-neutral-900 ring-offset-1" : ""}`}
                                  onClick={() => setSelected({ type: "SEAT", item: seat, section, row })}
                                >
                                  {seat.seatLabel.split("-").at(-1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {data.tableZones.length > 0 && (
                  <div className="rounded-xl border border-[var(--border)] p-4">
                    <h3 className="mb-3 text-base font-semibold text-neutral-900">Table Zones</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.tableZones.map((zone) => (
                        <button
                          key={zone.id}
                          type="button"
                          className={`rounded-xl border p-4 text-left transition hover:bg-neutral-50 ${selected?.item.id === zone.id ? "border-neutral-900" : "border-[var(--border)]"}`}
                          style={{ boxShadow: `inset 4px 0 0 ${zone.color ?? "#0f766e"}` }}
                          onClick={() => setSelected({ type: "TABLE_ZONE", item: zone })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-neutral-900">{zone.name}</span>
                            <Badge className="border-transparent bg-teal-100 text-teal-700">${Number(zone.price).toFixed(2)}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-neutral-500">
                            {zone.totalTables} tables / {zone.seatsPerTable} seats each
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="sticky top-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Config Panel</h2>
              <p className="text-sm text-neutral-500">{labelForSelection(selected)}</p>
            </div>

            {!selected ? (
              <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">Select an item on the canvas to edit its settings.</p>
            ) : (
              <div className="space-y-4">
                {selected.type === "SECTION" && (
                  <>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={sectionName} onChange={(event) => setSectionName(event.target.value)} />
                    </div>
                    <div className="grid grid-cols-[1fr_96px] gap-3">
                      <div className="space-y-2">
                        <Label>Color</Label>
                        <Input value={sectionColor} onChange={(event) => setSectionColor(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Swatch</Label>
                        <Input type="color" value={sectionColor} onChange={(event) => setSectionColor(event.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Section price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={sectionPrice}
                        onChange={(event) => setSectionPrice(event.target.value)}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-neutral-500">
                        Sync uses this price and the section seat count to create the checkout ticket.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Sort order</Label>
                      <Input type="number" min="0" value={sectionSortOrder} onChange={(event) => setSectionSortOrder(event.target.value)} />
                    </div>
                  </>
                )}

                {selected.type === "ROW" && (
                  <>
                    <div className="space-y-2">
                      <Label>Row label</Label>
                      <Input value={rowLabel} onChange={(event) => setRowLabel(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Sort order</Label>
                      <Input type="number" min="0" value={rowSortOrder} onChange={(event) => setRowSortOrder(event.target.value)} />
                    </div>
                  </>
                )}

                {selected.type === "SEAT" && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select className="app-select" value={seatStatus} onChange={(event) => setSeatStatus(event.target.value as SeatStatus)}>
                      <option value="AVAILABLE">Available</option>
                      <option value="RESERVED">Reserved</option>
                      <option value="SOLD">Sold</option>
                      <option value="BLOCKED">Blocked</option>
                    </select>
                  </div>
                )}

                {selected.type === "TABLE_ZONE" && (
                  <>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={tableName} onChange={(event) => setTableName(event.target.value)} />
                    </div>
                    <div className="grid grid-cols-[1fr_96px] gap-3">
                      <div className="space-y-2">
                        <Label>Color</Label>
                        <Input value={tableColor} onChange={(event) => setTableColor(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Swatch</Label>
                        <Input type="color" value={tableColor} onChange={(event) => setTableColor(event.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Seats/table</Label>
                        <Input type="number" min="1" value={seatsPerTable} onChange={(event) => setSeatsPerTable(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Total tables</Label>
                        <Input type="number" min="1" value={totalTables} onChange={(event) => setTotalTables(event.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input type="number" min="0" step="0.01" value={tablePrice} onChange={(event) => setTablePrice(event.target.value)} />
                    </div>
                  </>
                )}

                {(selected.type === "SECTION" || selected.type === "ROW") && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                    <h3 className="text-sm font-semibold text-sky-950">Auto-generate seats</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Rows</Label>
                        <Input
                          type="number"
                          min="1"
                          disabled={selected.type === "ROW"}
                          value={selected.type === "ROW" ? "1" : bulkRowCount}
                          onChange={(event) => setBulkRowCount(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Seats/row</Label>
                        <Input type="number" min="1" value={bulkSeatsPerRow} onChange={(event) => setBulkSeatsPerRow(event.target.value)} />
                      </div>
                    </div>
                    {selected.type === "SECTION" && (
                      <div className="mt-3 space-y-2">
                        <Label>Row prefix</Label>
                        <Input value={bulkRowPrefix} onChange={(event) => setBulkRowPrefix(event.target.value)} placeholder="Optional" />
                      </div>
                    )}
                    <Button className="mt-3 w-full" variant="outline" onClick={bulkGenerateSeats} disabled={saving}>
                      Generate Seats
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={saveSelected} disabled={saving}>
                    <Save className="h-4 w-4" /> Save
                  </Button>
                  <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={deleteSelected} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </SidebarLayout>
  );
}
