import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizerApprovalStatus, StripeOnboardingStatus, VenueStatus } from "@prisma/client";
import { Building2, CalendarDays, CheckCircle2, Clock3, DollarSign, Ticket, Wallet } from "lucide-react";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

export default async function OrganizerDashboardPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    redirect("/auth/login");
  }

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      payoutSettings: true,
      venues: { select: { id: true, status: true } },
      events: {
        select: {
          id: true,
          status: true,
          _count: { select: { orders: true } },
          ticketTypes: { select: { sold: true } },
          orders: {
            where: { status: "PAID" },
            select: { total: true },
          },
        },
      },
    },
  });
  if (!profile || profile.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    redirect("/organizer/status");
  }

  const completedOnboardingFields = [
    profile.companyName,
    profile.contactName,
    profile.phone,
    profile.taxId,
    profile.addressLine1,
    profile.cityId,
  ].filter(Boolean).length;
  const onboardingCompletion = Math.round((completedOnboardingFields / 6) * 100);
  const totalVenues = profile.venues.length;
  const pendingVenues = profile.venues.filter((venue) => venue.status === VenueStatus.PENDING_APPROVAL).length;
  const approvedVenues = profile.venues.filter((venue) => venue.status === VenueStatus.APPROVED).length;
  const rejectedVenues = profile.venues.filter((venue) => venue.status === VenueStatus.REJECTED).length;
  const totalEvents = profile.events.length;
  const publishedEvents = profile.events.filter((e) => e.status === "PUBLISHED").length;
  const rejectedEvents = profile.events.filter((e) => e.status === "REJECTED").length;
  const pendingApprovalEvents = profile.events.filter((e) => e.status === "PENDING_APPROVAL").length;
  const totalTicketsSold = profile.events.reduce((sum, e) => sum + e.ticketTypes.reduce((s, t) => s + t.sold, 0), 0);
  const totalRevenue = profile.events.reduce(
    (sum, e) => sum + e.orders.reduce((s, o) => s + Number(o.total), 0),
    0,
  );

  const payoutSettings = profile.payoutSettings;
  const payoutConfigured =
    payoutSettings?.payoutMode === "MANUAL"
      ? Boolean(payoutSettings.manualPayoutNote)
      : payoutSettings?.stripeOnboardingStatus === StripeOnboardingStatus.COMPLETED;

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader
        title="Home"
        subtitle="Track onboarding completion, venue approvals, and payout readiness in one place."
      />

      {(rejectedEvents > 0 || pendingApprovalEvents > 0) && (
        <section className="space-y-3">
          {rejectedEvents > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {rejectedEvents} event{rejectedEvents !== 1 ? "s" : ""} were rejected by admin.{" "}
              <Link href="/organizer/events" className="font-semibold underline underline-offset-4">
                Review and resubmit
              </Link>
              .
            </div>
          )}
          {pendingApprovalEvents > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {pendingApprovalEvents} event{pendingApprovalEvents !== 1 ? "s" : ""} are pending admin approval.{" "}
              <Link href="/organizer/events" className="font-semibold underline underline-offset-4">
                View events
              </Link>
              .
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.25)] bg-[rgb(var(--theme-accent-rgb)/0.08)] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="inline-flex rounded-md bg-[var(--theme-accent)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Approved
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Organizer tools are now active</h2>
            <p className="max-w-2xl text-sm text-neutral-700">
              Configure payouts and keep venue submissions up to date so your events can move to approval faster.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/organizer/payout" className={cn(buttonVariants({ variant: "default" }))}>
              Manage Payout
            </Link>
            <Link href="/organizer/venues" className={cn(buttonVariants({ variant: "outline" }))}>
              Open Venues
            </Link>
          </div>
        </div>
      </section>

      {/* Events stats row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Total Events</p>
            <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{totalEvents}</p>
          <p className="mt-1 text-xs text-neutral-500">{publishedEvents} published</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Tickets Sold</p>
            <Ticket className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{totalTicketsSold}</p>
          <p className="mt-1 text-xs text-neutral-500">Across all events</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Gross Revenue</p>
            <DollarSign className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">${totalRevenue.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-500">From paid orders (incl. fees)</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Quick Actions</p>
            <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <div className="mt-1 flex flex-col gap-2">
            <Link href="/organizer/events/new" className={cn(buttonVariants({ size: "sm" }), "w-full justify-center text-xs")}>
              + New Event
            </Link>
            <Link href="/organizer/events" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center text-xs")}>
              My Events
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Onboarding health</p>
            <CheckCircle2 className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{onboardingCompletion}%</p>
          <p className="mt-2 text-sm text-neutral-600">Profile completeness</p>
          <div className="mt-4 h-2.5 rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[var(--theme-accent)]"
              style={{ width: `${Math.max(8, onboardingCompletion)}%` }}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Venue pipeline</p>
            <Building2 className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{totalVenues}</p>
          <p className="mt-2 text-sm text-neutral-600">Total submitted venues</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-neutral-50 p-2">
              <p className="text-neutral-500">Pending</p>
              <p className="mt-1 font-semibold text-neutral-900">{pendingVenues}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-2">
              <p className="text-neutral-500">Approved</p>
              <p className="mt-1 font-semibold text-neutral-900">{approvedVenues}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-2">
              <p className="text-neutral-500">Rejected</p>
              <p className="mt-1 font-semibold text-neutral-900">{rejectedVenues}</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Payout readiness</p>
            <Wallet className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{payoutConfigured ? "Ready" : "Pending"}</p>
          <p className="mt-2 text-sm text-neutral-600">
            {payoutSettings?.payoutMode === "STRIPE_CONNECT"
              ? `Stripe: ${payoutSettings?.stripeOnboardingStatus?.replaceAll("_", " ") ?? "NOT STARTED"}`
              : "Manual settlement"}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--theme-accent-rgb)/0.08)] px-3 py-2 text-xs font-medium text-[var(--theme-accent)]">
            <Clock3 className="h-4 w-4" />
            {payoutConfigured ? "Payout path configured" : "Complete payout setup"}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold tracking-tight text-neutral-900">Next actions</h3>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700">
            <li className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
              Review organizer status updates and keep profile details current.
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
              Submit additional venue requests with finalized seating maps.
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
              Verify payout settings before receiving event settlements.
            </li>
          </ul>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold tracking-tight text-neutral-900">Workspace summary</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3 py-2">
              <dt className="text-neutral-600">Account status</dt>
              <dd className="font-semibold text-emerald-700">Approved</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3 py-2">
              <dt className="text-neutral-600">Payout mode</dt>
              <dd className="font-semibold text-neutral-900">{payoutSettings?.payoutMode ?? "MANUAL"}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3 py-2">
              <dt className="text-neutral-600">Total venues</dt>
              <dd className="font-semibold text-neutral-900">{totalVenues}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3 py-2">
              <dt className="text-neutral-600">Events</dt>
              <dd className="font-semibold text-neutral-900">{totalEvents} ({publishedEvents} live)</dd>
            </div>
          </dl>
        </article>
      </section>
    </SidebarLayout>
  );
}
