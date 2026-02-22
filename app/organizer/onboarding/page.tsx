"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { FormSection } from "@/src/components/shared/form-section";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
];

export default function OrganizerOnboardingPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    phone: "",
    contactName: "",
    taxId: "",
    addressLine1: "",
    addressLine2: "",
  });

  useEffect(() => {
    fetch("/api/organizer/onboarding")
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.data) {
          setForm({
            companyName: payload.data.companyName ?? "",
            phone: payload.data.phone ?? "",
            contactName: payload.data.contactName ?? "",
            taxId: payload.data.taxId ?? "",
            addressLine1: payload.data.addressLine1 ?? "",
            addressLine2: payload.data.addressLine2 ?? "",
          });
        }
      });
  }, []);

  async function submit(submitForApproval: boolean) {
    setLoading(true);
    const res = await fetch("/api/organizer/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, submit: submitForApproval }),
    });

    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Failed to save onboarding");
      return;
    }

    toast.success(submitForApproval ? "Submitted for approval" : "Draft saved");
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Organizer Onboarding" subtitle="Complete your profile to unlock dashboard access." />
      <FormSection title="Company Details" description="Save draft anytime, submit when ready.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Company Name</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
          <div className="space-y-2"><Label>Contact Name</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Tax ID</Label><Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Address 1</Label><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Address 2</Label><Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></div>
        </div>
        <div className="flex gap-3">
          <Button disabled={loading} variant="outline" onClick={() => submit(false)}>Save Draft</Button>
          <Button disabled={loading} onClick={() => submit(true)}>Submit for Approval</Button>
        </div>
      </FormSection>
    </SidebarLayout>
  );
}
