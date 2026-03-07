"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket } from "lucide-react";

export function PublicNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/events" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900">
          <Ticket className="h-5 w-5 text-[var(--theme-accent)]" />
          EventsBox
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/events"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              pathname === "/events"
                ? "bg-[rgb(var(--theme-accent-rgb)/0.1)] text-[var(--theme-accent)]"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Browse Events
          </Link>
          <Link
            href="/auth/login"
            className="ml-2 rounded-lg bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
