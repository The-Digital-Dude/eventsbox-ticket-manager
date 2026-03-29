import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import NotificationsPageClient from "@/app/account/notifications/notifications-page-client";

const PAGE_SIZE = 20;

function buildPageHref(page: number) {
  return `/account/notifications?page=${page}`;
}

export default async function AccountNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ATTENDEE") {
    redirect("/auth/login");
  }

  const profile = await prisma.attendeeProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [notifications, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        actionUrl: true,
        isRead: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    }),
    prisma.notification.count({
      where: { userId: session.user.id },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Notifications</h1>
        <p className="mt-2 text-sm text-neutral-600">Stay on top of booking confirmations, reminders, and waitlist updates.</p>
      </section>

      <NotificationsPageClient
        initialNotifications={notifications.map((notification) => ({
          ...notification,
          createdAt: notification.createdAt.toISOString(),
        }))}
        initialUnreadCount={unreadCount}
      />

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
