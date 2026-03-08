"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  joinedAt: string;
  notifiedAt: string | null;
};

type WaitlistGroup = {
  ticketTypeId: string;
  ticketTypeName: string;
  total: number;
  notifiedCount: number;
  entries: WaitlistEntry[];
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WaitlistGroupsClient({
  eventId,
  initialGroups,
}: {
  eventId: string;
  initialGroups: WaitlistGroup[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [pendingTicketTypeId, setPendingTicketTypeId] = useState<string | null>(null);

  async function notifyUnnotified(group: WaitlistGroup) {
    if (group.total === group.notifiedCount) return;

    setPendingTicketTypeId(group.ticketTypeId);
    const res = await fetch(`/api/organizer/events/${eventId}/waitlist/notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketTypeId: group.ticketTypeId }),
    });
    const payload = await res.json();
    setPendingTicketTypeId(null);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to notify waitlist");
      return;
    }

    const notified = Number(payload?.data?.notified ?? 0);
    if (notified <= 0) {
      toast.success("No un-notified entries left");
      return;
    }

    const nowIso = new Date().toISOString();
    setGroups((prev) =>
      prev.map((item) =>
        item.ticketTypeId === group.ticketTypeId
          ? {
              ...item,
              notifiedCount: item.total,
              entries: item.entries.map((entry) =>
                entry.notifiedAt ? entry : { ...entry, notifiedAt: nowIso },
              ),
            }
          : item,
      ),
    );
    toast.success(`Notified ${notified} waitlist entr${notified === 1 ? "y" : "ies"}`);
  }

  if (groups.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">No waitlist entries for this event yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const unnotifiedCount = group.total - group.notifiedCount;
        return (
          <section key={group.ticketTypeId} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-neutral-900">{group.ticketTypeName}</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-neutral-100 text-neutral-700 border-transparent">Total: {group.total}</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700 border-transparent">Notified: {group.notifiedCount}</Badge>
                  <Badge className="bg-amber-100 text-amber-700 border-transparent">Un-notified: {unnotifiedCount}</Badge>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void notifyUnnotified(group)}
                disabled={pendingTicketTypeId === group.ticketTypeId || unnotifiedCount === 0}
              >
                {pendingTicketTypeId === group.ticketTypeId ? "Notifying..." : "Notify Un-notified"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--border)] bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Notified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {group.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-neutral-900">{entry.email}</td>
                      <td className="px-4 py-3 text-neutral-700">{entry.name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-700">{formatDateTime(entry.joinedAt)}</td>
                      <td className="px-4 py-3 text-neutral-700">{entry.notifiedAt ? formatDateTime(entry.notifiedAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
