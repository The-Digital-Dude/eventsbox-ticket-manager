"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Search, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import { PublicNav } from "@/src/components/shared/public-nav";

type OrderLookup = {
  id: string;
  status: "PAID" | "REFUNDED";
  total: number | string;
  paidAt: string | null;
  event: {
    id: string;
    title: string;
    slug: string;
    startAt: string;
    status: string;
    venue: { name: string } | null;
  };
  items: Array<{ quantity: number; ticketType: { name: string } }>;
  _count: { tickets: number };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function TicketLookupPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderLookup[] | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Enter your email address");
    setLoading(true);
    setOrders(null);

    const res = await fetch("/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Lookup failed");
      return;
    }

    setOrders(payload.data);
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      <PublicNav />

      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex rounded-2xl bg-[rgb(var(--theme-accent-rgb)/0.08)] p-4">
            <Ticket className="h-8 w-8 text-[var(--theme-accent)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Find Your Tickets</h1>
          <p className="mt-2 text-neutral-600">Enter the email address used when booking to see your tickets.</p>
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <form onSubmit={handleLookup} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading} className="gap-2 sm:shrink-0">
              <Search className="h-4 w-4" />
              {loading ? "Searching..." : "Find Tickets"}
            </Button>
          </form>
        </section>

        {orders !== null && (
          <div className="mt-6 space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
                <p className="text-lg font-medium text-neutral-700">No tickets found</p>
                <p className="mt-1 text-sm text-neutral-500">
                  No paid orders were found for <strong>{email}</strong>.
                  Double-check the email used when booking.
                </p>
                <Link href="/events" className="mt-4 inline-block text-sm text-[var(--theme-accent)] underline underline-offset-4">
                  Browse Events
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-neutral-500">
                  Found {orders.length} order{orders.length !== 1 ? "s" : ""} for <strong>{email}</strong>
                </p>
                {orders.map((order) => (
                  <article key={order.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h2 className="font-semibold text-neutral-900 leading-snug">{order.event.title}</h2>
                        <div className="flex flex-wrap gap-2 text-sm text-neutral-600">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                            {formatDate(order.event.startAt)}
                          </span>
                          {order.event.venue && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                              {order.event.venue.name}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {order.items.map((item, i) => (
                            <span key={i} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                              {item.ticketType.name} × {item.quantity}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge className={order.status === "REFUNDED" ? "bg-neutral-100 text-neutral-600 border-transparent" : "bg-emerald-100 text-emerald-700 border-transparent"}>
                          {order.status}
                        </Badge>
                        <p className="mt-1 text-sm font-semibold text-neutral-900">${Number(order.total).toFixed(2)}</p>
                      </div>
                    </div>
                    {order.event.status === "CANCELLED" ? (
                      <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                        This event has been cancelled.
                      </p>
                    ) : (
                      <Link
                        href={`/orders/${order.id}`}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        View Tickets ({order._count.tickets})
                      </Link>
                    )}
                  </article>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
