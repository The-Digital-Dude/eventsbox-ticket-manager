import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { env } from "@/src/lib/env";
import { WaitlistGroupsClient } from "@/app/organizer/events/[id]/waitlist/waitlist-groups-client";

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  joinedAt: string;
  notifiedAt: string | null;
};

type WaitlistGroup = {
  ticketTypeId: string;
  ticketTypeName: string;
  total: number;
  notifiedCount: number;
  entries: WaitlistEntry[];
};

type WaitlistPayload = {
  data?: {
    eventId: string;
    eventTitle: string;
    totalEntries: number;
    byTicketType: WaitlistGroup[];
  };
};

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/affiliate", label: "Affiliate Links" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

export const revalidate = 0;

export default async function OrganizerEventWaitlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    redirect("/auth/login");
  }

  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${env.APP_URL}/api/organizer/events/${id}/waitlist`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    redirect("/auth/login");
  }

  if (res.status === 404) {
    redirect("/organizer/events");
  }

  const payload = (await res.json()) as WaitlistPayload;
  const data = payload.data ?? {
    eventId: id,
    eventTitle: "Event",
    totalEntries: 0,
    byTicketType: [] as WaitlistGroup[],
  };

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Waitlist</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{data.eventTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500">{data.totalEntries} total waitlist entr{data.totalEntries === 1 ? "y" : "ies"}</p>
        </div>
        <Link
          href={`/organizer/events/${id}`}
          className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Back to Event
        </Link>
      </section>

      <WaitlistGroupsClient eventId={id} initialGroups={data.byTicketType} />
    </SidebarLayout>
  );
}
