"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";

type OrganizerOption = {
  id: string;
  label: string;
  email: string;
};

export default function MonthlyReportForm({
  organizers,
  defaultMonth,
}: {
  organizers: OrganizerOption[];
  defaultMonth: string;
}) {
  const [selectedOrganizerId, setSelectedOrganizerId] = useState(organizers[0]?.id ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrganizerId) {
      toast.error("Select an organizer first");
      return;
    }

    if (!month) {
      toast.error("Choose a month first");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/admin/reports/send-monthly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizerProfileId: selectedOrganizerId,
          month,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error?.message ?? "Unable to send monthly revenue report");
        return;
      }

      toast.success(`Monthly revenue report sent to ${payload?.data?.email ?? "organizer"}`);
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900">Send Monthly Report</h2>
        <p className="mt-1 text-sm text-neutral-500">Trigger a revenue summary email for any approved organizer.</p>
      </div>

      {organizers.length === 0 ? (
        <p className="text-sm text-neutral-500">No approved organizers available yet.</p>
      ) : (
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="organizerProfileId" className="text-sm font-medium text-neutral-700">
              Organizer
            </label>
            <select
              id="organizerProfileId"
              className="app-select h-11"
              value={selectedOrganizerId}
              onChange={(event) => setSelectedOrganizerId(event.target.value)}
              disabled={isPending}
            >
              {organizers.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.label} ({organizer.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="month" className="text-sm font-medium text-neutral-700">
              Month
            </label>
            <input
              id="month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
              disabled={isPending}
            />
          </div>

          <Button type="submit" className="h-11 self-end" disabled={isPending}>
            {isPending ? "Sending..." : "Send Monthly Report"}
          </Button>
        </form>
      )}
    </section>
  );
}
