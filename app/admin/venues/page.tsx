"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Button } from "@/src/components/ui/button";

type VenueRow = {
  id: string;
  name: string;
  status: string;
  organizerProfile: { user: { email: string } };
};

const nav = [
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export default function AdminVenuesPage() {
  const [rows, setRows] = useState<VenueRow[]>([]);

  async function load() {
    const res = await fetch("/api/admin/venues");
    const payload = await res.json();
    setRows(payload?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/venues")
      .then((res) => res.json())
      .then((payload) => {
        if (active) setRows(payload?.data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  async function decide(id: string, action: "APPROVED" | "REJECTED") {
    const reason = action === "REJECTED" ? prompt("Rejection reason") ?? "Rejected by admin" : undefined;
    const res = await fetch(`/api/admin/venues/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Action failed");
    toast.success(`Venue ${action.toLowerCase()}`);
    await load();
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Venue Requests" subtitle="Review organizer venue onboarding requests." />
      <div className="grid gap-3">
        {rows.map((venue) => (
          <div key={venue.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="font-medium">{venue.name} <span className="text-sm text-neutral-500">({venue.status})</span></p>
            <p className="text-sm text-neutral-600">{venue.organizerProfile.user.email}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => decide(venue.id, "APPROVED")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => decide(venue.id, "REJECTED")}>Reject</Button>
            </div>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}
