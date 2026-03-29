"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Bell, Clock3, Info, Star, Ticket } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/src/components/ui/dropdown-menu";
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

type NotificationsPayload = {
  data?: {
    notifications: NotificationRow[];
    unreadCount: number;
  };
};

function formatTimeAgo(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
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

export function NotificationBell() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/account/notifications?unreadOnly=false&page=1", { cache: "no-store" });
      const payload = (await res.json()) as NotificationsPayload;
      if (!res.ok) return;

      setNotifications(payload.data?.notifications ?? []);
      setUnreadCount(payload.data?.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

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

  async function markSingleRead(id: string) {
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
      return true;
    } catch {
      return false;
    } finally {
      setMarkingId(null);
    }
  }

  async function handleNotificationOpen(
    event: MouseEvent<HTMLAnchorElement>,
    notification: NotificationRow,
  ) {
    if (isModifiedClick(event)) return;
    if (notification.isRead) return;

    event.preventDefault();
    const destination = notification.actionUrl ?? "/account/notifications";
    await markSingleRead(notification.id);
    router.push(destination);
    router.refresh();
  }

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative ml-1 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-neutral-700 transition hover:bg-neutral-100"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>
              <p className="text-xs text-neutral-500">{unreadCount} unread</p>
            </div>
            <Button size="sm" variant="ghost" onClick={markAllRead} disabled={markingAllRead || unreadCount === 0}>
              {markingAllRead ? "Saving..." : "Mark all read"}
            </Button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!loading && recentNotifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-neutral-500">No notifications yet.</div>
          ) : (
            recentNotifications.map((notification) => {
              const Icon = getIcon(notification.type);

              return (
                <Link
                  key={notification.id}
                  href={notification.actionUrl ?? "/account/notifications"}
                  onClick={(event) => void handleNotificationOpen(event, notification)}
                  className={`flex gap-3 border-b border-[var(--border)] px-4 py-3 transition hover:bg-neutral-50 ${
                    notification.isRead ? "bg-white" : "bg-[rgb(var(--theme-accent-rgb)/0.05)]"
                  }`}
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[var(--theme-accent)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-neutral-900">{notification.title}</span>
                      <span className="shrink-0 text-[11px] text-neutral-400">{formatTimeAgo(notification.createdAt)}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-neutral-600">{notification.body}</span>
                  </span>
                </Link>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--border)] px-4 py-3">
          <Link href="/account/notifications" className="text-sm font-medium text-[var(--theme-accent)] hover:underline">
            View all
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
