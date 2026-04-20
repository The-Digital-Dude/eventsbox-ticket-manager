"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type EventAddOn = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  maxPerOrder: number;
  totalStock: number | null;
  isActive: boolean;
  sortOrder: number;
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

export default function EventAddOnsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [eventTitle, setEventTitle] = useState("");
  const [addOns, setAddOns] = useState<EventAddOn[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    maxPerOrder: "10",
    totalStock: "",
  });

  const load = useCallback(async () => {
    try {
      const [evRes, addOnsRes] = await Promise.all([
        fetch(`/api/organizer/events/${id}`),
        fetch(`/api/organizer/events/${id}/addons`),
      ]);
      const evPayload = await evRes.json();
      const addOnsPayload = await addOnsRes.json();

      if (!evRes.ok) {
        toast.error("Event not found");
        router.push("/organizer/events");
        return;
      }

      setEventTitle(evPayload.data.title);
      setAddOns(addOnsPayload.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAddOn() {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.price) return toast.error("Price is required");

    setSaving(true);
    const res = await fetch(`/api/organizer/events/${id}/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        maxPerOrder: Number(form.maxPerOrder),
        totalStock: form.totalStock ? Number(form.totalStock) : null,
      }),
    });
    const payload = await res.json();
    setSaving(false);

    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to create add-on");
    
    toast.success("Add-on created");
    setForm({ name: "", description: "", price: "", maxPerOrder: "10", totalStock: "" });
    setShowForm(false);
    await load();
  }

  async function toggleAddOn(addOnId: string, isActive: boolean) {
    const res = await fetch(`/api/organizer/events/${id}/addons/${addOnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) return toast.error("Failed to update add-on");
    toast.success(isActive ? "Add-on deactivated" : "Add-on activated");
    await load();
  }

  async function deleteAddOn(addOnId: string, name: string) {
    if (!confirm(`Delete add-on "${name}"?`)) return;
    const res = await fetch(`/api/organizer/events/${id}/addons/${addOnId}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to delete add-on");
    toast.success("Add-on deleted");
    await load();
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="space-y-6">
        <div>
          <Link href={`/organizer/events/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
            <ChevronLeft className="h-4 w-4" /> Back to Event
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900">Add-ons</h1>
          <p className="mt-1 text-sm text-neutral-600">{eventTitle}</p>
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Available Add-ons</h2>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "+ New Add-on"}
            </Button>
          </div>

          {showForm && (
            <div className="mb-6 rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.04)] p-5">
              <h3 className="mb-4 text-base font-semibold text-neutral-900">New Add-on</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name <span className="text-red-500">*</span></Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. VIP Parking" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
                </div>
                <div className="space-y-2">
                  <Label>Price ($) <span className="text-red-500">*</span></Label>
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Max per order</Label>
                  <Input type="number" min="1" value={form.maxPerOrder} onChange={(e) => setForm({ ...form, maxPerOrder: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Total Stock (Optional)</Label>
                  <Input type="number" min="1" value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: e.target.value })} placeholder="Leave empty for unlimited" />
                </div>
              </div>
              <Button className="mt-4" onClick={createAddOn} disabled={saving}>
                {saving ? "Saving..." : "Save Add-on"}
              </Button>
            </div>
          )}

          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
          ) : addOns.length === 0 ? (
            <p className="text-sm text-neutral-500">No add-ons created yet.</p>
          ) : (
            <div className="space-y-3">
              {addOns.map((addOn) => (
                <div key={addOn.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900">{addOn.name}</span>
                      {!addOn.isActive && <Badge className="bg-neutral-100 text-neutral-500">Inactive</Badge>}
                    </div>
                    {addOn.description && <p className="text-sm text-neutral-600">{addOn.description}</p>}
                    <div className="flex gap-4 text-xs text-neutral-500">
                      <span>Price: ${Number(addOn.price).toFixed(2)}</span>
                      <span>Max per order: {addOn.maxPerOrder}</span>
                      <span>Stock: {addOn.totalStock === null ? "Unlimited" : addOn.totalStock}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleAddOn(addOn.id, addOn.isActive)}>
                      {addOn.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => deleteAddOn(addOn.id, addOn.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
