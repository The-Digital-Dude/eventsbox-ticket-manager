import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { env } from "@/src/lib/env";
import { OrdersTableClient } from "@/app/account/orders/orders-table-client";

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

type OrdersPayload = {
  data?: {
    orders?: OrderRow[];
    total?: number;
    pages?: number;
  };
};

export const revalidate = 0;

function buildPageHref(page: number) {
  return `/account/orders?page=${page}`;
}

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ATTENDEE") {
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${env.APP_URL}/api/account/orders?page=${page}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    redirect("/auth/login");
  }

  const payload = (await res.json()) as OrdersPayload;
  const orders = payload.data?.orders ?? [];
  const pages = payload.data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">My Orders</h1>
        <p className="mt-2 text-sm text-neutral-600">View your paid and refunded ticket orders.</p>
      </section>

      {orders.length === 0 ? (
        <section className="rounded-xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
          <p className="text-neutral-700">No orders yet.</p>
          <Link href="/events" className="mt-3 inline-block text-sm font-medium text-[var(--theme-accent)] hover:underline">
            Browse events
          </Link>
        </section>
      ) : (
        <OrdersTableClient initialOrders={orders} />
      )}

      <div className="flex items-center justify-between">
        <div>
          {page > 1 ? (
            <Link href={buildPageHref(page - 1)} className="text-sm font-medium text-[var(--theme-accent)] hover:underline">
              Previous
            </Link>
          ) : (
            <span className="text-sm text-neutral-400">Previous</span>
          )}
        </div>
        <p className="text-sm text-neutral-600">Page {page} of {pages}</p>
        <div>
          {page < pages ? (
            <Link href={buildPageHref(page + 1)} className="text-sm font-medium text-[var(--theme-accent)] hover:underline">
              Next
            </Link>
          ) : (
            <span className="text-sm text-neutral-400">Next</span>
          )}
        </div>
      </div>
    </div>
  );
}
