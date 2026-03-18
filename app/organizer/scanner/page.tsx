"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type Scanner = {
  id: string;
  user: { email: string; isActive: boolean };
};

export default function OrganizerScannersPage() {
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const load = useCallback(async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/organizer/scanners");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to load scanners");
      setScanners(payload.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createScanner() {
    if (!form.email.trim() || !form.password.trim()) {
      return toast.error("Email and password are required");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/organizer/scanners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to create scanner");
      
      toast.success(`Scanner account created for ${payload.data.user.email}`);
      setForm({ email: "", password: "" });
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error creating scanner");
    } finally {
      setSaving(false);
    }
  }
  
  async function toggleActive(scannerId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/organizer/scanners/${scannerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Scanner ${!isActive ? 'enabled' : 'disabled'}`);
      await load();
    } catch {
      toast.error("Error updating scanner status");
    }
  }

  async function deleteScanner(scannerId: string, email: string) {
    if (!confirm(`Permanently delete scanner account ${email}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/organizer/scanners/${scannerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete scanner");
      toast.success("Scanner account deleted");
      await load();
    } catch {
      toast.error("Error deleting scanner");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Scanner Accounts</h2>
        <Button size="sm" onClick={() => setShowForm(p => !p)}>
          {showForm ? 'Cancel' : '+ New Scanner'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-4 text-base font-semibold">New Scanner Account</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
          </div>
          <Button className="mt-4" onClick={createScanner} disabled={saving}>
            {saving ? 'Creating...' : 'Create Account'}
          </Button>
        </div>
      )}

      {loading ? <div className="h-32 bg-neutral-100 animate-pulse rounded-xl" /> : (
        <div className="space-y-3">
          {scanners.map(s => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
              <p className="font-semibold">{s.user.email}</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.user.isActive}
                    onChange={() => toggleActive(s.id, s.user.isActive)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {s.user.isActive ? 'Active' : 'Disabled'}
                </label>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteScanner(s.id, s.user.email)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
