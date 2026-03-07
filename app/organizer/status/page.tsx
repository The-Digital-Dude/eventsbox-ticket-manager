"use client";

import { useEffect, useState } from "react";
import { OrganizerApprovalStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Clock3, FileBadge2, FileCheck2 } from "lucide-react";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatusBanner } from "@/src/components/shared/status-banner";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
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

  const currentStatus = state?.status ?? "DRAFT";
  const transitionProgress: Record<OrganizerApprovalStatus, number> = {
    DRAFT: 0,
    PENDING_APPROVAL: 1,
    APPROVED: 2,
    REJECTED: 1,
    SUSPENDED: 2,
  };

  function getStepState(stepIndex: number): "done" | "active" | "upcoming" | "failed" {
    if (currentStatus === "DRAFT") return stepIndex === 0 ? "active" : "upcoming";
    if (currentStatus === "PENDING_APPROVAL") return stepIndex === 0 ? "done" : stepIndex === 1 ? "active" : "upcoming";
    if (currentStatus === "APPROVED") return "done";
    if (currentStatus === "REJECTED") return stepIndex === 0 ? "done" : stepIndex === 1 ? "failed" : "upcoming";
    return stepIndex <= 1 ? "done" : "failed";
  }

  const timelineItems = [
    {
      title: "Profile Draft",
      subtitle: "Complete onboarding profile details",
      icon: FileBadge2,
    },
    {
      title: "Submitted",
      subtitle: currentStatus === "REJECTED" ? "Review ended with rejection" : "Sent for admin review",
      icon: FileCheck2,
    },
    {
      title: currentStatus === "SUSPENDED" ? "Suspended" : "Approved",
      subtitle:
        currentStatus === "SUSPENDED"
          ? "Account paused by admin"
          : currentStatus === "APPROVED"
            ? "Organizer tools unlocked"
            : "Awaiting final decision",
      icon: currentStatus === "SUSPENDED" ? AlertTriangle : currentStatus === "APPROVED" ? CheckCircle2 : Clock3,
    },
  ];

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Approval Status" subtitle="Track admin review status and next steps." />
      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 text-sm text-neutral-600">Loading status...</div>
      ) : null}
      {state ? <StatusBanner status={state.status} reason={state.reason} className="w-full" /> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {timelineItems.map((item, index) => {
          const stepState = getStepState(index);
          const isConnected = index < 2 && index < transitionProgress[currentStatus];

          const cardTone =
            stepState === "done"
              ? "border-[rgb(var(--theme-accent-rgb)/0.22)] bg-gradient-to-br from-[rgb(var(--theme-accent-rgb)/0.08)] to-white"
              : stepState === "active"
                ? "border-[rgb(var(--theme-accent-rgb)/0.45)] bg-gradient-to-br from-[rgb(var(--theme-accent-rgb)/0.13)] to-white"
                : stepState === "failed"
                  ? "border-red-200 bg-gradient-to-br from-red-50 to-white"
                  : "border-[var(--border)] bg-white";

          const iconTone =
            stepState === "failed"
              ? "text-red-600"
              : stepState === "upcoming"
                ? "text-neutral-400"
                : "text-[var(--theme-accent)]";

          const badgeTone =
            stepState === "done"
              ? "bg-[rgb(var(--theme-accent-rgb)/0.12)] text-[var(--theme-accent)]"
              : stepState === "active"
                ? "bg-[var(--theme-accent)] text-white"
                : stepState === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-neutral-100 text-neutral-600";

          const badgeLabel =
            stepState === "done"
              ? "Done"
              : stepState === "active"
                ? "Current"
                : stepState === "failed"
                  ? "Issue"
                  : "Pending";

          return (
            <article key={item.title} className={`relative rounded-2xl border p-5 shadow-sm transition ${cardTone}`}>
              {index < 2 ? (
                <span
                  className={`absolute -right-4 top-1/2 z-10 hidden h-0.5 w-4 -translate-y-1/2 lg:block ${
                    isConnected ? "bg-[var(--theme-accent)]" : "bg-[var(--border)]"
                  }`}
                />
              ) : null}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] bg-white text-[11px] font-semibold text-neutral-600">
                    {index + 1}
                  </span>
                  <item.icon className={`h-5 w-5 ${iconTone}`} />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>{badgeLabel}</span>
              </div>
              <h3 className="text-base font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{item.subtitle}</p>
            </article>
          );
        })}
      </section>
    </SidebarLayout>
  );
}
