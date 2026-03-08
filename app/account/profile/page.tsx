"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type ProfileResponse = {
  data?: {
    email?: string;
    displayName?: string | null;
    phone?: string | null;
    createdAt?: string;
  };
  error?: { message?: string };
};

export default function AccountProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const res = await fetch("/api/account/profile");

      if (res.status === 401 || res.status === 403) {
        router.push("/auth/login");
        return;
      }

      const payload = (await res.json()) as ProfileResponse;
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Unable to load profile");
        return;
      }

      if (!active) {
        return;
      }

      setEmail(payload.data?.email ?? "");
      setDisplayName(payload.data?.displayName ?? "");
      setPhone(payload.data?.phone ?? "");
      setLoading(false);
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: displayName || undefined,
        phone: phone || undefined,
      }),
    });

    const payload = (await res.json()) as ProfileResponse;
    setSaving(false);

    if (!res.ok) {
      toast.error(payload.error?.message ?? "Unable to update profile");
      return;
    }

    toast.success("Profile updated");
  }

  if (loading) {
    return <p className="text-sm text-neutral-600">Loading profile...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">My Profile</h1>
        <p className="mt-2 text-sm text-neutral-600">Update your attendee profile details.</p>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled readOnly />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>

        <Button onClick={saveProfile} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>

        <p className="text-sm text-neutral-600">
          <Link href="/auth/forgot-password" className="font-medium text-[var(--theme-accent)] hover:underline">
            Change Password
          </Link>
        </p>
      </section>
    </div>
  );
}
