"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, Users } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import Link from "next/link";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

type OrderItem = {
  id: string;
  quantity: number;
  subtotal: number | string;
  ticketType: { id: string; name: string };
};

type Order = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  status: string;
  subtotal: number | string;
  platformFee: number | string;
  gst: number | string;
  total: number | string;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function EventOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    async function load() {
      const [ordersRes, eventRes] = await Promise.all([
        fetch(`/api/organizer/events/${id}/orders`),
        fetch(`/api/organizer/events/${id}`),
      ]);
      if (!ordersRes.ok) { toast.error("Failed to load orders"); router.push(`/organizer/events/${id}`); return; }
      const ordersPayload = await ordersRes.json();
      setOrders(ordersPayload.data ?? []);
      if (eventRes.ok) {
        const eventPayload = await eventRes.json();
        setEventTitle(eventPayload.data?.title ?? "");
      }
      setLoading(false);
    }
    load();
  }, [id, router]);

  const filtered = orders.filter((o) =>
    !q.trim() ||
    o.buyerName.toLowerCase().includes(q.toLowerCase()) ||
    o.buyerEmail.toLowerCase().includes(q.toLowerCase()),
  );

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalTickets = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  function exportCSV() {
    const rows = [
      ["Order ID", "Buyer Name", "Email", "Tickets", "Total", "Paid At"].join(","),
      ...orders.map((o) => [
        o.id,
        `"${o.buyerName}"`,
        o.buyerEmail,
        o.items.reduce((s, i) => s + i.quantity, 0),
        Number(o.total).toFixed(2),
        o.paidAt ? formatDateTime(o.paidAt) : "",
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="flex items-center gap-3">
        <Link href={`/organizer/events/${id}`} className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to event
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Orders</h1>
          {eventTitle && <p className="mt-1 text-sm text-neutral-500">{eventTitle}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={orders.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-sm text-neutral-500">Paid Orders</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-900">{orders.length}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-sm text-neutral-500">Tickets Sold</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-900">{totalTickets}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-sm text-neutral-500">Gross Revenue</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-900">${totalRevenue.toFixed(2)}</p>
        </article>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email..."
        className="max-w-xs"
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-medium text-neutral-700">{q ? "No orders match your search" : "No paid orders yet"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Tickets</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Paid At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{order.buyerName}</p>
                    <p className="text-xs text-neutral-500">{order.buyerEmail}</p>
                    <p className="mt-0.5 font-mono text-xs text-neutral-400">{order.id.slice(0, 12)}…</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-1.5">
                          <Badge className="bg-neutral-100 text-neutral-600 border-transparent text-xs">{item.quantity}×</Badge>
                          <span className="text-neutral-700">{item.ticketType.name}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-neutral-900">${Number(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-neutral-500">{order.paidAt ? formatDateTime(order.paidAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SidebarLayout>
  );
}
