"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type AffiliateLinkRow = {
  id: string;
  code: string;
  label: string | null;
  commissionPct: number;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  eventId: string | null;
  event: { title: string; slug: string } | null;
  _count: { orders: number };
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
  { href: "/organizer/series", label: "Series" },
];

export default function AffiliatePage() {
  const [links, setLinks] = useState<AffiliateLinkRow[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    code: "",
    label: "",
    eventId: "",
    commissionPct: "10",
  });

  async function loadData() {
    setLoading(true);
    try {
      const [linksRes, eventsRes] = await Promise.all([
        fetch("/api/organizer/affiliate"),
        fetch("/api/organizer/events"),
      ]);

      const linksPayload = await linksRes.json();
      const eventsPayload = await eventsRes.json();

      if (!linksRes.ok) throw new Error(linksPayload.error?.message || "Failed to load links");
      if (!eventsRes.ok) throw new Error(eventsPayload.error?.message || "Failed to load events");

      setLinks(linksPayload.data);
      setEvents(eventsPayload.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createLink() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/organizer/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim() || undefined,
          label: form.label.trim() || undefined,
          eventId: form.eventId || undefined,
          commissionPct: Number(form.commissionPct),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to create link");

      setLinks((current) => [payload.data, ...current]);
      setForm({ code: "", label: "", eventId: "", commissionPct: "10" });
      toast.success("Affiliate link created");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error creating link");
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(id: string) {
    try {
      const res = await fetch(`/api/organizer/affiliate/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to deactivate link");

      setLinks((current) =>
        current.map((l) => (l.id === id ? { ...l, isActive: false } : l)),
      );
      toast.success("Affiliate link deactivated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error deactivating link");
    }
  }

  function copyUrl(link: AffiliateLinkRow) {
    const origin = window.location.origin;
    const url = link.event?.slug
      ? `${origin}/events/${link.event.slug}?ref=${link.code}`
      : `${origin}?ref=${link.code}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard");
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Create Affiliate Link</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Code (Optional)</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Partner Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Event</Label>
              <select
                className="app-select"
                value={form.eventId}
                onChange={(e) => setForm({ ...form, eventId: e.target.value })}
              >
                <option value="">All Events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Commission %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.commissionPct}
                onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={createLink} disabled={submitting}>
              {submitting ? "Creating..." : "Create Link"}
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">Your Affiliate Links</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600">
              <thead className="bg-neutral-50/50 text-neutral-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Label</th>
                  <th className="px-6 py-3 font-medium">Event</th>
                  <th className="px-6 py-3 font-medium">Comm. %</th>
                  <th className="px-6 py-3 font-medium">Clicks</th>
                  <th className="px-6 py-3 font-medium">Orders</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">Loading...</td>
                  </tr>
                ) : links.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">
                      No affiliate links created yet.
                    </td>
                  </tr>
                ) : (
                  links.map((link) => (
                    <tr key={link.id} className="hover:bg-neutral-50/50">
                      <td className="px-6 py-4"><Badge className="font-mono">{link.code}</Badge></td>
                      <td className="px-6 py-4">{link.label || "—"}</td>
                      <td className="px-6 py-4">{link.event?.title || "All Events"}</td>
                      <td className="px-6 py-4">{link.commissionPct}%</td>
                      <td className="px-6 py-4">{link.clickCount}</td>
                      <td className="px-6 py-4">{link._count.orders}</td>
                      <td className="px-6 py-4">
                        {link.isActive ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        ) : (
                          <Badge className="bg-neutral-100 text-neutral-600 border-neutral-200">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyUrl(link)}>
                            Copy URL
                          </Button>
                          {link.isActive && (
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deactivate(link.id)}>
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}