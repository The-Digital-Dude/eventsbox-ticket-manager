"use client";

import { useEffect, useState } from "react";
import { OrganizerApprovalStatus } from "@prisma/client";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatusBanner } from "@/src/components/shared/status-banner";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
];

export default function OrganizerStatusPage() {
  const [state, setState] = useState<{ status: OrganizerApprovalStatus; reason?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organizer/status")
      .then((r) => r.json())
      .then((payload) => setState(payload.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Approval Status" subtitle="Track admin review status and next steps." />
      {loading ? <p className="text-sm text-neutral-600">Loading status...</p> : null}
      {state ? <StatusBanner status={state.status} reason={state.reason} /> : null}
    </SidebarLayout>
  );
}
