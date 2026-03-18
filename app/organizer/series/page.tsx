"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/src/components/ui/dialog";

type SeriesRow = {
  id: string;
  title: string;
  description: string | null;
  recurrenceType: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | null;
  recurrenceDaysOfWeek: number[];
  recurrenceEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { events: number };
};

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

const emptyForm = {
  title: "",
  description: "",
  recurrenceType: "" as string,
  recurrenceEndDate: "",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function OrganizerSeriesPage() {
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [genCount, setGenCount] = useState(1);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  async function loadSeries() {
    setLoading(true);
    try {
      const response = await fetch("/api/organizer/series");
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? "Failed to load event series");
        return;
      }

      setSeries(payload?.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSeries();
  }, []);

  async function createSeries() {
    if (!form.title.trim()) {
      toast.error("Series title is required");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/organizer/series", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        recurrenceType: form.recurrenceType || undefined,
        recurrenceEndDate: form.recurrenceEndDate ? new Date(form.recurrenceEndDate).toISOString() : undefined,
      }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      toast.error(payload?.error?.message ?? "Failed to create event series");
      return;
    }

    setSeries((current) => [payload.data, ...current]);
    setForm(emptyForm);
    toast.success("Series created");
  }

  function startEditing(entry: SeriesRow) {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      description: entry.description ?? "",
      recurrenceType: entry.recurrenceType ?? "",
      recurrenceEndDate: entry.recurrenceEndDate ? new Date(entry.recurrenceEndDate).toISOString().split("T")[0] : "",
    });
  }

  async function saveEdit(seriesId: string) {
    if (!editForm.title.trim()) {
      toast.error("Series title is required");
      return;
    }

    const response = await fetch(`/api/organizer/series/${seriesId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        recurrenceType: editForm.recurrenceType || undefined,
        recurrenceEndDate: editForm.recurrenceEndDate ? new Date(editForm.recurrenceEndDate).toISOString() : undefined,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload?.error?.message ?? "Failed to update series");
      return;
    }

    setSeries((current) =>
      current.map((entry) => (entry.id === seriesId ? payload.data : entry)),
    );
    setEditingId(null);
    setEditForm(emptyForm);
    toast.success("Series updated");
  }

  async function deleteSeries(seriesId: string) {
    if (!confirm("Are you sure you want to delete this series?")) return;
    const response = await fetch(`/api/organizer/series/${seriesId}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload?.error?.message ?? "Failed to delete series");
      return;
    }

    setSeries((current) => current.filter((entry) => entry.id !== seriesId));
    toast.success("Series deleted");
  }

  async function generateEvents(seriesId: string) {
    setSubmitting(true);
    const res = await fetch(`/api/organizer/series/${seriesId}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: genCount }),
    });
    const payload = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Generation failed");
      return;
    }

    toast.success(`Generated ${payload.data.created} event(s)`);
    setGeneratingFor(null);
    loadSeries();
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Event Series</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Group related events under one public series page and assign events from the edit screen.
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Create Series</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              maxLength={100}
              placeholder="2026 City Concert Series"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="h-28 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              maxLength={2000}
              placeholder="Optional description shown on the public series page."
            />
          </div>
          <div className="space-y-2">
            <Label>Recurrence Type</Label>
            <select
              className="app-select"
              value={form.recurrenceType}
              onChange={(e) => setForm((prev) => ({ ...prev, recurrenceType: e.target.value }))}
            >
              <option value="">No recurrence</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Recurrence End Date</Label>
            <Input
              type="date"
              value={form.recurrenceEndDate}
              onChange={(e) => setForm((prev) => ({ ...prev, recurrenceEndDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={createSeries} disabled={submitting}>
            {submitting ? "Creating..." : "Create Series"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Your Series</h2>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-sm text-neutral-500">Loading series...</div>
        ) : series.length === 0 ? (
          <div className="px-6 py-8 text-sm text-neutral-500">No event series yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {series.map((entry) => {
              const isEditing = editingId === entry.id;

              return (
                <div key={entry.id} className="space-y-4 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={editForm.title}
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, title: event.target.value }))
                            }
                            maxLength={100}
                          />
                          <textarea
                            className="h-24 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, description: event.target.value }))
                            }
                            maxLength={2000}
                          />
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Recurrence</Label>
                              <select
                                className="app-select h-9 text-xs"
                                value={editForm.recurrenceType}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, recurrenceType: e.target.value }))}
                              >
                                <option value="">No recurrence</option>
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="BIWEEKLY">Bi-weekly</option>
                                <option value="MONTHLY">Monthly</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">End Date</Label>
                              <Input
                                type="date"
                                className="h-9 text-xs"
                                value={editForm.recurrenceEndDate}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, recurrenceEndDate: e.target.value }))}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-semibold text-neutral-900">{entry.title}</h3>
                            <Badge>{entry._count.events} event{entry._count.events === 1 ? "" : "s"}</Badge>
                            {entry.recurrenceType && (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 capitalize">
                                {entry.recurrenceType.toLowerCase()}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-neutral-600">
                            {entry.description || "No description added yet."}
                          </p>
                          <p className="text-xs text-neutral-400">
                            Updated {formatDateTime(entry.updatedAt)}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={() => void saveEdit(entry.id)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditForm(emptyForm);
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          {entry.recurrenceType && (
                            <Dialog open={generatingFor === entry.id} onOpenChange={(open) => !open && setGeneratingFor(null)}>
                              <Button size="sm" variant="outline" onClick={() => setGeneratingFor(entry.id)}>
                                Generate Events
                              </Button>
                              <DialogContent>
                                <h3 className="text-lg font-semibold">Generate Recurring Events</h3>
                                <p className="mt-2 text-sm text-neutral-600">
                                  Duplicate the latest event in &quot;{entry.title}&quot; forward by {entry.recurrenceType.toLowerCase()} intervals.
                                </p>
                                <div className="mt-4 space-y-2">
                                  <Label>Number of events to create (1–52)</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={52}
                                    value={genCount}
                                    onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                                  />
                                </div>
                                <div className="mt-6 flex justify-end gap-3">
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogClose>
                                  <Button onClick={() => generateEvents(entry.id)} disabled={submitting}>
                                    {submitting ? "Generating..." : "Confirm & Generate"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          <Button size="sm" variant="outline" onClick={() => startEditing(entry)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void deleteSeries(entry.id)}>
                            Delete
                          </Button>
                          <Link
                            href={`/events/series/${entry.id}`}
                            className={cn(buttonVariants({ size: "sm" }))}
                          >
                            View Events
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </SidebarLayout>
  );
}
