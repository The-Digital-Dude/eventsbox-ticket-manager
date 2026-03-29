"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { NotificationBell } from "@/src/components/shared/notification-bell";

type SessionRole = "ATTENDEE" | "ORGANIZER" | "SUPER_ADMIN" | null;

type AuthState = {
  loading: boolean;
  role: SessionRole;
};

export function PublicNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ loading: true, role: null });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!active) return;

        if (!res.ok) {
          setAuth({ loading: false, role: null });
          return;
        }

        const payload = (await res.json()) as { data?: { role?: SessionRole } };
        setAuth({ loading: false, role: payload.data?.role ?? null });
      } catch {
        if (active) {
          setAuth({ loading: false, role: null });
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuth({ loading: false, role: null });
      router.refresh();
      if (pathname?.startsWith("/account")) {
        router.push("/auth/login");
      }
    } finally {
      setLoggingOut(false);
    }
  }

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
            href="/tickets"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              pathname === "/tickets"
                ? "bg-[rgb(var(--theme-accent-rgb)/0.1)] text-[var(--theme-accent)]"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            My Tickets
          </Link>

          {!auth.loading && auth.role === "ATTENDEE" ? (
            <>
              <NotificationBell />
              <Link
                href="/account/dashboard"
                className="ml-2 rounded-lg bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                My Account
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                disabled={loggingOut}
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </>
          ) : !auth.loading && !auth.role ? (
            <>
              <Link
                href="/auth/login"
                className="ml-2 rounded-lg bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register/attendee"
                className="ml-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Register
              </Link>
            </>
          ) : !auth.loading && (auth.role === "ORGANIZER" || auth.role === "SUPER_ADMIN") ? (
            <Link
              href="/auth/login"
              className="ml-2 rounded-lg bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Sign In
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className="ml-2 rounded-lg bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
