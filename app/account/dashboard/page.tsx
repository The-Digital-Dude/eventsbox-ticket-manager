import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";

export const revalidate = 60;

export default async function AccountDashboardPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "ATTENDEE") {
    redirect("/auth/login");
  }

  const [profile, unreadNotifications] = await Promise.all([
    prisma.attendeeProfile.findUnique({
      where: { userId: session.user.id },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    }),
  ]);

  if (!profile) {
    redirect("/auth/login");
  }

  const displayName = profile.displayName ?? session.user.email;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Welcome, {displayName}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Total orders: {profile._count.orders} · Unread notifications: {unreadNotifications}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/account/orders" className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:border-[var(--theme-accent)]">
          <h2 className="text-lg font-semibold text-neutral-900">My Orders</h2>
          <p className="mt-2 text-sm text-neutral-600">View your paid and refunded order history.</p>
        </Link>

        <Link href="/account/tickets" className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:border-[var(--theme-accent)]">
          <h2 className="text-lg font-semibold text-neutral-900">My Tickets</h2>
          <p className="mt-2 text-sm text-neutral-600">Access your QR tickets for upcoming and past events.</p>
        </Link>

        <Link href="/account/profile" className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:border-[var(--theme-accent)]">
          <h2 className="text-lg font-semibold text-neutral-900">My Profile</h2>
          <p className="mt-2 text-sm text-neutral-600">Update your display name and phone number.</p>
        </Link>

        <Link href="/account/notifications" className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:border-[var(--theme-accent)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Notifications</h2>
              <p className="mt-2 text-sm text-neutral-600">Catch up on booking confirmations, reminders, and waitlist alerts.</p>
            </div>
            <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-[rgb(var(--theme-accent-rgb)/0.08)] px-3 py-1 text-sm font-semibold text-[var(--theme-accent)]">
              {unreadNotifications}
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}
