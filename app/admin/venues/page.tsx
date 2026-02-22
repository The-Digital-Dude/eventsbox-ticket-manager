"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { SeatMapReadOnly } from "@/src/components/shared/seat-map-readonly";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent } from "@/src/components/ui/dialog";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

type VenueRow = {
  id: string;
  name: string;
  status: string;
  totalSeats: number | null;
  totalTables: number | null;
  seatingUpdatedAt: string | null;
  seatingConfig?: VenueSeatingConfig | null;
  seatState?: Record<string, SeatState> | null;
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
  const [selectedVenue, setSelectedVenue] = useState<VenueRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function load(includeLayout = false) {
    const res = await fetch(`/api/admin/venues?includeLayout=${includeLayout ? "true" : "false"}`);
    const payload = await res.json();
    setRows(payload?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/venues?includeLayout=false")
      .then((res) => res.json())
      .then((payload) => {
        if (active) {
          setRows(payload?.data ?? []);
        }
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

  async function openLayout(venueId: string) {
    const res = await fetch("/api/admin/venues?includeLayout=true");
    const payload = await res.json();
    const fullRows = (payload?.data ?? []) as VenueRow[];
    const venue = fullRows.find((entry) => entry.id === venueId) ?? null;
    setSelectedVenue(venue);
    setPreviewOpen(true);
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Venue Requests" subtitle="Review venue requests and inspect seating layouts." />
      <div className="grid gap-3">
        {rows.map((venue) => (
          <div key={venue.id} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
            <p className="font-medium">
              {venue.name} <span className="text-sm text-neutral-500">({venue.status})</span>
            </p>
            <p className="text-sm text-neutral-600">{venue.organizerProfile.user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge>Seats: {venue.totalSeats ?? 0}</Badge>
              <Badge>Tables: {venue.totalTables ?? 0}</Badge>
              <Badge>Layout: {venue.seatingUpdatedAt ? "Configured" : "Not configured"}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => decide(venue.id, "APPROVED")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => decide(venue.id, "REJECTED")}>Reject</Button>
              <Button size="sm" variant="outline" onClick={() => openLayout(venue.id)}>View Layout</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Venue Layout Preview</h3>
            {!selectedVenue?.seatingConfig ? (
              <p className="text-sm text-neutral-600">No seating configuration found for this venue yet.</p>
            ) : (
              <SeatMapReadOnly config={selectedVenue.seatingConfig} seatState={selectedVenue.seatState} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
