"use client";

import Link from "next/link";
import { useState } from "react";
import { Fragment } from "react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";

type OrderRow = {
  id: string;
  total: number | string;
  status: "PAID" | "REFUNDED";
  paidAt: string | null;
  event: { title: string; startAt: string; slug: string };
  items: Array<{ quantity: number; ticketType: { name: string } }>;
  cancellationRequest?: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" } | null;
};

function formatDate(input: string | null) {
  if (!input) return "-";
  return new Date(input).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function statusBadgeClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "REFUNDED") return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-neutral-100 text-neutral-600 border-[var(--border)]";
}

export function OrdersTableClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function requestCancellation(orderId: string) {
    setSubmitting(true);
    const res = await fetch(`/api/account/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to request cancellation");
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? { ...order, cancellationRequest: { id: payload.data.requestId, status: "PENDING" } }
          : order,
      ),
    );
    setReason("");
    setActiveOrderId(null);
    toast.success("Cancellation request submitted");
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Tickets</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">View</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {orders.map((order) => {
            const ticketSummary = order.items.map((item) => `${item.ticketType.name} x${item.quantity}`).join(", ");
            const isPendingCancellation = order.cancellationRequest?.status === "PENDING";

            return (
              <Fragment key={order.id}>
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{order.event.title}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{formatDate(order.event.startAt)}</td>
                  <td className="px-4 py-3 text-neutral-600">{ticketSummary}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">${Number(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isPendingCancellation ? (
                      <Badge className="bg-amber-100 text-amber-700 border-transparent">Cancellation Requested</Badge>
                    ) : order.status === "PAID" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveOrderId((prev) => (prev === order.id ? null : order.id));
                          setReason("");
                        }}
                      >
                        Request Cancellation
                      </Button>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="text-sm font-medium text-[var(--theme-accent)] hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
                {activeOrderId === order.id && (
                  <tr key={`${order.id}-cancel-form`}>
                    <td colSpan={7} className="bg-neutral-50 px-4 py-3">
                      <div className="space-y-2">
                        <label htmlFor={`reason-${order.id}`} className="text-xs font-medium text-neutral-700">
                          Reason (optional)
                        </label>
                        <textarea
                          id={`reason-${order.id}`}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          rows={3}
                          maxLength={1000}
                          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-700 outline-none focus:border-[var(--theme-accent)]"
                          placeholder="Share your reason for cancellation request..."
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => requestCancellation(order.id)} disabled={submitting}>
                            {submitting ? "Submitting..." : "Submit Request"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActiveOrderId(null);
                              setReason("");
                            }}
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
