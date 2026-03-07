"use client";

import Link from "next/link";
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
  { href: "/admin/events", label: "Events" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export default function AdminOrganizersPage() {
  const [rows, setRows] = useState<OrganizerRow[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  async function load(
    nextStatus: string = status,
    nextQ: string = q,
    onRows: (nextRows: OrganizerRow[]) => void = setRows,
  ) {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    const trimmedQ = nextQ.trim();
    if (trimmedQ) params.set("q", trimmedQ);
    const query = params.toString();
    const url = query ? `/api/admin/organizers?${query}` : "/api/admin/organizers";
    const res = await fetch(url);
    const payload = await res.json();
    const nextRows = payload?.data ?? [];
    onRows(nextRows);
    return nextRows;
  }

  useEffect(() => {
    let active = true;

    load(status, q, (nextRows) => {
      if (active) setRows(nextRows);
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

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
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <select className="app-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <input
            type="text"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search email or company..."
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
          />
        </div>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No organizers match the current filter.</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.user.email}</TableCell>
                <TableCell>{row.companyName ?? "-"}</TableCell>
                <TableCell>{row.approvalStatus}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link href={`/admin/organizers/${row.id}`}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
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
