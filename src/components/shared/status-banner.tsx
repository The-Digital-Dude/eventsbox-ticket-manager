import { OrganizerApprovalStatus } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Clock3, ShieldX } from "lucide-react";
import { cn } from "@/src/lib/utils";

export function StatusBanner({
  status,
  reason,
  className,
}: {
  status: OrganizerApprovalStatus;
  reason?: string | null;
  className?: string;
}) {
  const tones: Record<OrganizerApprovalStatus, { shell: string; chip: string; stepOn: string }> = {
    DRAFT: {
      shell: "border-[var(--border)] bg-white text-neutral-900",
      chip: "bg-neutral-100 text-neutral-700",
      stepOn: "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white",
    },
    PENDING_APPROVAL: {
      shell: "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-900",
      chip: "bg-amber-100 text-amber-900",
      stepOn: "border-amber-500 bg-amber-500 text-white",
    },
    APPROVED: {
      shell: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-900",
      chip: "bg-emerald-100 text-emerald-900",
      stepOn: "border-emerald-600 bg-emerald-600 text-white",
    },
    REJECTED: {
      shell: "border-red-200 bg-gradient-to-br from-red-50 to-white text-red-900",
      chip: "bg-red-100 text-red-900",
      stepOn: "border-red-600 bg-red-600 text-white",
    },
    SUSPENDED: {
      shell: "border-red-300 bg-gradient-to-br from-red-100 to-white text-red-950",
      chip: "bg-red-200 text-red-950",
      stepOn: "border-red-700 bg-red-700 text-white",
    },
  };

  const icons: Record<OrganizerApprovalStatus, LucideIcon> = {
    DRAFT: Clock3,
    PENDING_APPROVAL: Clock3,
    APPROVED: BadgeCheck,
    REJECTED: ShieldX,
    SUSPENDED: ShieldX,
  };
  const Icon = icons[status];

  const helpText: Record<OrganizerApprovalStatus, string> = {
    DRAFT: "Complete onboarding and submit when ready.",
    PENDING_APPROVAL: "Our team is reviewing your submission.",
    APPROVED: "Access unlocked. You can manage payout and venues now.",
    REJECTED: "Please update details and submit again.",
    SUSPENDED: "Contact support to restore account access.",
  };

  const progressStep: Record<OrganizerApprovalStatus, number> = {
    DRAFT: 0,
    PENDING_APPROVAL: 1,
    APPROVED: 2,
    REJECTED: 1,
    SUSPENDED: 2,
  };
  const steps = ["Profile", "Review", "Live"];
  const isAlertStatus = status === "REJECTED" || status === "SUSPENDED";
  const tone = tones[status];

  return (
    <div className={cn("relative overflow-hidden rounded-3xl border px-5 py-5 shadow-sm md:px-6", tone.shell, className)}>
      <div className="pointer-events-none absolute -right-10 -top-8 h-36 w-36 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.12)] blur-2xl" />
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/80 p-2 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/80">Current status</p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold tracking-tight">{status.replaceAll("_", " ")}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]", tone.chip)}>
                {status === "APPROVED" ? "Done" : status === "PENDING_APPROVAL" ? "In Review" : "Active"}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-current/90">{helpText[status]}</p>
            {reason ? <p className="text-sm font-medium">Reason: {reason}</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Journey</p>
          {isAlertStatus ? (
            <p className="mt-2 text-sm text-neutral-700">
              Account needs attention. Resolve review notes and resubmit to return to active flow.
            </p>
          ) : (
            <div className="relative mt-3 grid grid-cols-3 gap-2">
              <div className="pointer-events-none absolute left-[16%] right-[16%] top-3 h-px bg-[var(--border)]" />
              {steps.map((step, index) => {
                const completed = index <= progressStep[status];
                return (
                  <div key={step} className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold",
                        completed
                          ? tone.stepOn
                          : "border-[var(--border)] bg-white text-neutral-400",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className={cn("text-xs", completed ? "text-neutral-800" : "text-neutral-500")}>{step}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
