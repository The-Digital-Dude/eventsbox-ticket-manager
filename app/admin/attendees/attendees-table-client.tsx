"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";

type AttendeeRow = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  emailVerified: boolean;
  isActive: boolean;
  orderCount: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function AttendeesTableClient({ initialAttendees }: { initialAttendees: AttendeeRow[] }) {
  const [attendees, setAttendees] = useState<AttendeeRow[]>(initialAttendees);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggleAttendee(attendee: AttendeeRow) {
    setPendingId(attendee.id);
    const res = await fetch(`/api/admin/attendees/${attendee.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !attendee.isActive }),
    });
    const payload = await res.json();
    setPendingId(null);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to update attendee");
      return;
    }

    setAttendees((prev) =>
      prev.map((row) => (row.id === attendee.id ? { ...row, isActive: payload.data.isActive } : row)),
    );
    toast.success(payload.data.isActive ? "Attendee unsuspended" : "Attendee suspended");
  }

  if (attendees.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">No attendees match the selected filters.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Display Name</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {attendees.map((attendee) => (
              <tr key={attendee.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900">{attendee.email}</td>
                <td className="px-4 py-3 text-neutral-700">{attendee.displayName || "—"}</td>
                <td className="px-4 py-3 text-neutral-700">{attendee.orderCount}</td>
                <td className="px-4 py-3 text-neutral-700">{formatDate(attendee.createdAt)}</td>
                <td className="px-4 py-3 text-neutral-700">{attendee.emailVerified ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <Badge className={attendee.isActive ? "bg-emerald-100 text-emerald-700 border-transparent" : "bg-red-100 text-red-700 border-transparent"}>
                    {attendee.isActive ? "Active" : "Suspended"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant={attendee.isActive ? "outline" : "default"}
                    className={attendee.isActive ? "text-red-600 hover:bg-red-50" : ""}
                    onClick={() => void toggleAttendee(attendee)}
                    disabled={pendingId === attendee.id}
                  >
                    {pendingId === attendee.id ? "Saving..." : attendee.isActive ? "Suspend" : "Unsuspend"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
