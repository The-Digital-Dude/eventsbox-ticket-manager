"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Button } from "@/src/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";

type OrganizerRow = {
  id: string;
  companyName: string | null;
  approvalStatus: string;
  user: { email: string };
};

const nav = [
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export default function AdminOrganizersPage() {
  const [rows, setRows] = useState<OrganizerRow[]>([]);

  async function load() {
    const res = await fetch("/api/admin/organizers");
    const payload = await res.json();
    setRows(payload?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/organizers")
      .then((res) => res.json())
      .then((payload) => {
        if (active) setRows(payload?.data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  async function decide(id: string, action: "APPROVED" | "REJECTED" | "SUSPENDED") {
    const reason = action === "REJECTED" ? prompt("Rejection reason") ?? "Rejected by admin" : undefined;
    const res = await fetch(`/api/admin/organizers/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Action failed");
    toast.success(`Organizer ${action.toLowerCase()}`);
    await load();
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Organizer Governance" subtitle="Approve, reject, or suspend organizer accounts." />
      <div className="rounded-2xl border border-neutral-200 bg-white p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.user.email}</TableCell>
                <TableCell>{row.companyName ?? "-"}</TableCell>
                <TableCell>{row.approvalStatus}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(row.id, "APPROVED")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(row.id, "REJECTED")}>Reject</Button>
                    <Button size="sm" variant="destructive" onClick={() => decide(row.id, "SUSPENDED")}>Suspend</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SidebarLayout>
  );
}
