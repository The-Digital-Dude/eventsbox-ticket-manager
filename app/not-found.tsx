import Link from "next/link";
import { Ticket } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--page-bg,#f8f8f8)] px-4 text-center">
      <div className="mb-6 inline-flex rounded-2xl bg-[rgb(var(--theme-accent-rgb)/0.08)] p-5">
        <Ticket className="h-10 w-10 text-[var(--theme-accent)]" />
      </div>
      <h1 className="text-5xl font-bold tracking-tight text-neutral-900">404</h1>
      <p className="mt-2 text-xl font-medium text-neutral-700">Page not found</p>
      <p className="mx-auto mt-3 max-w-sm text-neutral-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-xl bg-[var(--theme-accent)] px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Go Home
        </Link>
        <Link
          href="/events"
          className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-white px-6 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        >
          Browse Events
        </Link>
      </div>
    </div>
  );
}
