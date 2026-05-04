"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  MapPin,
  Moon,
  ScanLine,
  ReceiptText,
  Settings,
  Store,
  Sun,
  Wallet,
} from "lucide-react";
import { Badge } from "@/src/components/ui/badge";

export function SidebarLayout({
  role,
  title,
  items,
  children,
}: {
  role: "admin" | "organizer";
  title: string;
  items: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const iconMap: Record<string, ComponentType<{ className?: string }>> = {
    status: ClipboardCheck,
    onboarding: ListChecks,
    dashboard: LayoutDashboard,
    analytics: BarChart2,
    payout: Wallet,
    payouts: Wallet,
    venues: Store,
    organizers: Building2,
    events: CalendarDays,
    series: CalendarDays,
    orders: ReceiptText,
    scanner: ScanLine,
    pos: ReceiptText,
    "platform config": Settings,
    categories: Compass,
    locations: MapPin,
  };
  const navigationItems = (() => {
    if (role !== "organizer") {
      return items;
    }

    const withPos = items.some((item) => item.href === "/organizer/pos")
      ? items
      : (() => {
          const posItem = { href: "/organizer/pos", label: "POS" };
          const eventIndex = items.findIndex((item) => item.href === "/organizer/events");
          if (eventIndex === -1) return [...items, posItem];
          return [...items.slice(0, eventIndex + 1), posItem, ...items.slice(eventIndex + 1)];
        })();

    if (withPos.some((item) => item.href === "/organizer/series")) {
      return withPos;
    }

    const seriesItem = { href: "/organizer/series", label: "Series" };
    const eventIndex = withPos.findIndex((item) => item.href === "/organizer/events");
    if (eventIndex === -1) {
      return [...withPos, seriesItem];
    }

    return [
      ...withPos.slice(0, eventIndex + 1),
      seriesItem,
      ...withPos.slice(eventIndex + 1),
    ];
  })();

  const titleLabel = role === "admin" ? "Control Center" : "Organizer Workspace";

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("theme-dark"));
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/auth/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  function toggleTheme() {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.classList.toggle("theme-dark", next);
    localStorage.setItem("eventsbox-theme", next ? "dark" : "light");
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg)]">
      <div className="flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 self-start flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--sidebar-bg)] px-5 py-6 lg:flex">
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xl font-semibold tracking-tight text-[var(--sidebar-text)]">{title}</p>
              <Badge className="capitalize">{role}</Badge>
            </div>
            <p className="text-sm text-[var(--sidebar-muted)]">{titleLabel}</p>
          </div>
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const normalizedLabel = item.label.toLowerCase();
              const Icon = iconMap[normalizedLabel] ?? LayoutDashboard;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "bg-[rgb(var(--theme-accent-rgb)/0.1)] font-medium text-[var(--theme-accent)]"
                      : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-[var(--border)] bg-[rgb(var(--theme-accent-rgb)/0.04)] p-4">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-[var(--theme-accent)]" />
              <p className="text-sm font-medium text-[var(--sidebar-text)]">Need help?</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--sidebar-muted)]">
              Keep data updated and submit requests from the pages in this menu.
            </p>
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-1 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[var(--theme-secondary)] transition hover:bg-[rgb(var(--theme-secondary-rgb)/0.12)]"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="h-[1em] w-[1em]" /> : <Moon className="h-[1em] w-[1em]" />}
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 pb-8 pt-4 md:px-8 md:pt-7">
          <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--sidebar-mobile-bg)] p-2 lg:hidden">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-[var(--theme-accent)] text-white"
                      : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="mb-6 lg:hidden">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-1 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[var(--theme-secondary)] transition hover:bg-[rgb(var(--theme-secondary-rgb)/0.12)]"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="h-[1em] w-[1em]" /> : <Moon className="h-[1em] w-[1em]" />}
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
          <main className="space-y-6 md:space-y-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
