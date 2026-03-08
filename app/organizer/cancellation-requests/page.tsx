import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { env } from "@/src/lib/env";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { RequestsTableClient } from "@/app/organizer/cancellation-requests/requests-table-client";

type CancellationRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type CancellationRequestRow = {
  id: string;
  orderId: string;
  reason: string | null;
  status: CancellationRequestStatus;
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

type CancellationRequestsPayload = {
  data?: CancellationRequestRow[];
};

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

function parseStatus(value: string | undefined): CancellationRequestStatus | undefined {
  if (!value) return undefined;
  if (value === "PENDING" || value === "APPROVED" || value === "REJECTED") return value;
  return undefined;
}

export const revalidate = 0;

export default async function OrganizerCancellationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const status = parseStatus(sp.status) ?? "PENDING";

  const cookieHeader = (await cookies()).toString();
  const query = new URLSearchParams({ status });
  const res = await fetch(`${env.APP_URL}/api/organizer/cancellation-requests?${query}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    redirect("/auth/login");
  }

  const payload = (await res.json()) as CancellationRequestsPayload;
  const requests = payload.data ?? [];

  const tabs: Array<{ label: string; value: CancellationRequestStatus }> = [
    { label: "Pending", value: "PENDING" },
    { label: "Approved", value: "APPROVED" },
    { label: "Rejected", value: "REJECTED" },
  ];

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Cancellation Requests</h1>
        <p className="mt-2 text-sm text-neutral-600">Review attendee cancellation requests and decide refund actions.</p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = status === tab.value;
            return (
              <a
                key={tab.value}
                href={`/organizer/cancellation-requests?status=${tab.value}`}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-[var(--theme-accent)] text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </section>

      <RequestsTableClient initialRequests={requests} statusFilter={status} />
    </SidebarLayout>
  );
}
