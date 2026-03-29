"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Bell, Clock3, Info, Star, Ticket } from "lucide-react";
import { Button } from "@/src/components/ui/button";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

function formatTimeAgo(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleString();
}

function getIcon(type: string) {
  if (type === "ORDER_CONFIRMED") return Ticket;
  if (type === "EVENT_REMINDER") return Clock3;
  if (type === "WAITLIST_OPEN") return Bell;
  if (type === "REVIEW_PROMPT") return Star;
  return Info;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export default function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationRow[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function markAllRead() {
    if (markingAllRead || unreadCount === 0) return;

    setMarkingAllRead(true);
    try {
      const res = await fetch("/api/account/notifications/read", { method: "PATCH" });
      if (!res.ok) return;

      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
      router.refresh();
    } finally {
      setMarkingAllRead(false);
    }
  }

  async function markSingleRead(id: string, options?: { refresh?: boolean }) {
    const refresh = options?.refresh ?? true;
    const target = notifications.find((notification) => notification.id === id);
    if (!target || target.isRead) return true;
    if (markingId && markingId !== id) return false;

    setMarkingId(id);
    try {
      const res = await fetch(`/api/account/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) return false;

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, isRead: true } : notification,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      if (refresh) {
        router.refresh();
      }
      return true;
    } catch {
      return false;
    } finally {
      setMarkingId(null);
    }
  }

  async function handleOpenNotification(
    event: MouseEvent<HTMLAnchorElement>,
    notification: NotificationRow,
  ) {
    if (isModifiedClick(event)) return;
    if (!notification.actionUrl || notification.isRead) return;

    event.preventDefault();
    await markSingleRead(notification.id, { refresh: false });
    router.push(notification.actionUrl);
  }

  if (notifications.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-medium text-neutral-900">No notifications yet</p>
        <p className="mt-2 text-sm text-neutral-500">We&apos;ll show booking, reminder, and waitlist updates here.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm text-neutral-500">Unread notifications</p>
          <p className="text-2xl font-semibold text-neutral-900">{unreadCount}</p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={markingAllRead || unreadCount === 0}>
          {markingAllRead ? "Saving..." : "Mark all read"}
        </Button>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => {
          const Icon = getIcon(notification.type);

          return (
            <article
              key={notification.id}
              className={`rounded-xl border p-4 shadow-sm ${
                notification.isRead
                  ? "border-[var(--border)] bg-white"
                  : "border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.05)]"
              }`}
            >
              <div className="flex gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--theme-accent)] shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-neutral-900">{notification.title}</h2>
                      <p className="mt-1 text-sm text-neutral-600">{notification.body}</p>
                    </div>
                    <p className="text-xs text-neutral-400">{formatTimeAgo(notification.createdAt)}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!notification.isRead && (
                      <Button size="sm" variant="outline" onClick={() => markSingleRead(notification.id)} disabled={markingId === notification.id}>
                        {markingId === notification.id ? "Saving..." : "Mark read"}
                      </Button>
                    )}
                    {notification.actionUrl && (
                      <Link
                        href={notification.actionUrl}
                        onClick={(event) => void handleOpenNotification(event, notification)}
                        className="text-sm font-medium text-[var(--theme-accent)] hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
