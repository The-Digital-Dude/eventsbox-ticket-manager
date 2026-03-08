"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type CancellationRequestRow = {
  id: string;
  orderId: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  order: {
    buyerEmail: string;
    buyerName: string;
    total: number | string;
    status: string;
    event: {
      id: string;
      title: string;
    };
  };
};

function statusBadgeClass(status: CancellationRequestRow["status"]) {
  if (status === "PENDING") return "bg-amber-100 text-amber-700 border-transparent";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700 border-transparent";
  return "bg-red-100 text-red-700 border-transparent";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function RequestsTableClient({
  initialRequests,
  statusFilter,
}: {
  initialRequests: CancellationRequestRow[];
  statusFilter: "PENDING" | "APPROVED" | "REJECTED" | undefined;
}) {
  const [requests, setRequests] = useState<CancellationRequestRow[]>(initialRequests);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function updateRequest(id: string, action: "APPROVE" | "REJECT", note?: string) {
    setSubmittingId(id);
    const res = await fetch(`/api/organizer/cancellation-requests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        ...(note ? { adminNote: note } : {}),
      }),
    });
    const payload = await res.json();
    setSubmittingId(null);
    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to process request");
      return;
    }

    const nextStatus = payload?.data?.status as CancellationRequestRow["status"];
    if (statusFilter && nextStatus !== statusFilter) {
      setRequests((prev) => prev.filter((row) => row.id !== id));
    } else {
      setRequests((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: nextStatus,
                adminNote: payload?.data?.adminNote ?? row.adminNote,
                resolvedAt: payload?.data?.resolvedAt ?? row.resolvedAt,
                order: {
                  ...row.order,
                  status: payload?.data?.status === "APPROVED" ? "REFUNDED" : row.order.status,
                },
              }
            : row,
        ),
      );
    }

    setRejectingId(null);
    setAdminNote("");
    toast.success(action === "APPROVE" ? "Request approved and refunded" : "Request rejected");
  }

  if (requests.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">No cancellation requests found for this status.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-3">Attendee Email</th>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Requested At</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="px-4 py-3 text-neutral-700">{request.order.buyerEmail}</td>
              <td className="px-4 py-3 text-neutral-700">{request.order.event.title}</td>
              <td className="px-4 py-3 text-neutral-700">{request.reason || "—"}</td>
              <td className="px-4 py-3 text-neutral-700">{formatDateTime(request.createdAt)}</td>
              <td className="px-4 py-3">
                <Badge className={statusBadgeClass(request.status)}>{request.status}</Badge>
              </td>
              <td className="px-4 py-3">
                {request.status === "PENDING" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!confirm("Approve this cancellation request and issue refund?")) return;
                          void updateRequest(request.id, "APPROVE");
                        }}
                        disabled={submittingId === request.id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setRejectingId((prev) => (prev === request.id ? null : request.id));
                          setAdminNote("");
                        }}
                        disabled={submittingId === request.id}
                      >
                        Reject
                      </Button>
                    </div>
                    {rejectingId === request.id && (
                      <div className="space-y-2">
                        <Input
                          value={adminNote}
                          onChange={(event) => setAdminNote(event.target.value)}
                          placeholder="Optional admin note"
                          maxLength={1000}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => void updateRequest(request.id, "REJECT", adminNote.trim() || undefined)}
                          disabled={submittingId === request.id}
                        >
                          Confirm Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500">Resolved</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
