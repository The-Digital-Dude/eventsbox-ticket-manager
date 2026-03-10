"use client";

import Link from "next/link";
import { useState } from "react";
import { Fragment } from "react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type OrderRow = {
  id: string;
  total: number | string;
  status: "PAID" | "REFUNDED";
  paidAt: string | null;
  event: { title: string; startAt: string; slug: string };
  items: Array<{
    quantity: number;
    ticketType: { name: string };
    tickets: Array<{
      id: string;
      ticketNumber: string;
      checkedInAt: string | null;
      transfer: {
        id: string;
        status: "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED";
        toEmail: string;
        toName: string;
        expiresAt: string;
      } | null;
    }>;
  }>;
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
  const [renderedAt] = useState(() => Date.now());
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeTransferTicketId, setActiveTransferTicketId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [transferRecipientName, setTransferRecipientName] = useState("");
  const [transferRecipientEmail, setTransferRecipientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [cancelTransferSubmittingId, setCancelTransferSubmittingId] = useState<string | null>(null);

  function setTicketTransferState(
    orderId: string,
    ticketId: string,
    transfer: OrderRow["items"][number]["tickets"][number]["transfer"],
  ) {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              items: order.items.map((item) => ({
                ...item,
                tickets: item.tickets.map((ticket) =>
                  ticket.id === ticketId ? { ...ticket, transfer } : ticket,
                ),
              })),
            }
          : order,
      ),
    );
  }

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

  async function requestTransfer(orderId: string, ticketId: string) {
    if (!transferRecipientName.trim()) {
      toast.error("Recipient name is required");
      return;
    }
    if (!transferRecipientEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }

    setTransferSubmitting(true);
    const res = await fetch(`/api/account/orders/${orderId}/tickets/${ticketId}/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toName: transferRecipientName.trim(),
        toEmail: transferRecipientEmail.trim(),
      }),
    });
    const payload = await res.json();
    setTransferSubmitting(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to transfer ticket");
      return;
    }

    setTicketTransferState(orderId, ticketId, {
      id: payload.data.transferId,
      status: "PENDING",
      toName: transferRecipientName.trim(),
      toEmail: transferRecipientEmail.trim(),
      expiresAt: payload.data.expiresAt,
    });
    setTransferRecipientName("");
    setTransferRecipientEmail("");
    setActiveTransferTicketId(null);
    toast.success(`Transfer request sent to ${payload.data.toEmail}`);
  }

  async function cancelTransfer(orderId: string, ticketId: string) {
    setCancelTransferSubmittingId(ticketId);
    const res = await fetch(`/api/account/orders/${orderId}/tickets/${ticketId}/transfer`, {
      method: "DELETE",
    });
    const payload = await res.json();
    setCancelTransferSubmittingId(null);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to cancel transfer");
      return;
    }

    setTicketTransferState(orderId, ticketId, null);
    toast.success("Transfer cancelled");
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
            const eventStarted = new Date(order.event.startAt).getTime() <= renderedAt;

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
                <tr key={`${order.id}-tickets`}>
                  <td colSpan={7} className="bg-neutral-50 px-4 py-4">
                    <div className="space-y-3">
                      {order.items.flatMap((item) =>
                        item.tickets.map((ticket) => {
                          const transfer = ticket.transfer;
                          const canTransfer =
                            order.status === "PAID" &&
                            !isPendingCancellation &&
                            !eventStarted &&
                            !ticket.checkedInAt &&
                            transfer?.status !== "PENDING" &&
                            transfer?.status !== "ACCEPTED";

                          return (
                            <div
                              key={ticket.id}
                              className="rounded-lg border border-[var(--border)] bg-white px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-neutral-900">
                                    {item.ticketType.name} · {ticket.ticketNumber}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500">
                                    {ticket.checkedInAt ? (
                                      <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                                        Checked in
                                      </Badge>
                                    ) : null}
                                    {eventStarted ? (
                                      <Badge className="border-transparent bg-neutral-100 text-neutral-600">
                                        Event started
                                      </Badge>
                                    ) : null}
                                    {transfer?.status === "ACCEPTED" ? (
                                      <Badge className="border-transparent bg-sky-100 text-sky-700">
                                        Transferred to {transfer.toName}
                                      </Badge>
                                    ) : null}
                                    {transfer?.status === "PENDING" ? (
                                      <Badge className="border-transparent bg-amber-100 text-amber-700">
                                        Transfer pending until {formatDate(transfer.expiresAt)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {transfer?.status === "PENDING" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void cancelTransfer(order.id, ticket.id)}
                                      disabled={cancelTransferSubmittingId === ticket.id}
                                    >
                                      {cancelTransferSubmittingId === ticket.id ? "Cancelling..." : "Cancel Transfer"}
                                    </Button>
                                  ) : canTransfer ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setActiveTransferTicketId((prev) => (prev === ticket.id ? null : ticket.id));
                                        setTransferRecipientName("");
                                        setTransferRecipientEmail("");
                                      }}
                                    >
                                      Transfer
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-neutral-400">Transfer unavailable</span>
                                  )}
                                </div>
                              </div>

                              {activeTransferTicketId === ticket.id ? (
                                <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-neutral-50 p-3">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <Input
                                      value={transferRecipientName}
                                      onChange={(event) => setTransferRecipientName(event.target.value)}
                                      placeholder="Recipient name"
                                    />
                                    <Input
                                      type="email"
                                      value={transferRecipientEmail}
                                      onChange={(event) => setTransferRecipientEmail(event.target.value)}
                                      placeholder="recipient@example.com"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => void requestTransfer(order.id, ticket.id)}
                                      disabled={transferSubmitting}
                                    >
                                      {transferSubmitting ? "Sending..." : "Send Transfer"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setActiveTransferTicketId(null);
                                        setTransferRecipientName("");
                                        setTransferRecipientEmail("");
                                      }}
                                      disabled={transferSubmitting}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        }),
                      )}
                    </div>
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
