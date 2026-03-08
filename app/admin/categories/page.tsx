"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";

type CategoryRow = { id: string; name: string };

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const res = await fetch("/api/admin/categories");
    const payload = await res.json();
    setRows(payload?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((payload) => {
        if (active) setRows(payload?.data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  async function add() {
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isActive: true }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to create category");
    setName("");
    toast.success("Category created");
    await load();
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Categories" subtitle="Manage event categories for venue mapping." />
      <div className="flex gap-2 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
      <div className="grid gap-2">
        {rows.map((row) => <div key={row.id} className="rounded-xl border border-[var(--border)] bg-white p-3 text-sm shadow-sm">{row.name}</div>)}
      </div>
    </SidebarLayout>
  );
}
