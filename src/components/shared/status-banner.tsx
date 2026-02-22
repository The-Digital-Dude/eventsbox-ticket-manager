import { OrganizerApprovalStatus } from "@prisma/client";
import { cn } from "@/src/lib/utils";

export function StatusBanner({ status, reason }: { status: OrganizerApprovalStatus; reason?: string | null }) {
  const tones: Record<OrganizerApprovalStatus, string> = {
    DRAFT: "bg-neutral-100 text-neutral-800 border-neutral-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-800 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    REJECTED: "bg-red-50 text-red-800 border-red-200",
    SUSPENDED: "bg-red-100 text-red-900 border-red-300",
  };

  return (
    <div className={cn("rounded-2xl border p-4 text-sm", tones[status])}>
      <p className="font-semibold">Current status: {status.replaceAll("_", " ")}</p>
      {reason ? <p className="mt-1">Reason: {reason}</p> : null}
    </div>
  );
}
