"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type UnsubscribeState =
  | { status: "loading" }
  | { status: "success"; email?: string }
  | { status: "error" };

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<UnsubscribeState>(token ? { status: "loading" } : { status: "error" });

  useEffect(() => {
    if (!token) {
      return;
    }
    const unsubscribeToken = token;

    let active = true;

    async function run() {
      try {
        const response = await fetch(`/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: { email?: string } };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setState({ status: "error" });
          return;
        }

        setState({ status: "success", email: payload.data?.email });
      } catch {
        if (active) {
          setState({ status: "error" });
        }
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg,#f8f8f8)] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-white p-8 shadow-sm">
        {state.status === "loading" ? (
          <>
            <h1 className="text-2xl font-semibold text-neutral-900">Updating your email preferences</h1>
            <p className="mt-3 text-sm text-neutral-600">Please wait while we process your unsubscribe request.</p>
          </>
        ) : state.status === "success" ? (
          <>
            <h1 className="text-2xl font-semibold text-neutral-900">You&apos;re unsubscribed</h1>
            <p className="mt-3 text-sm text-neutral-600">
              You&apos;ve been unsubscribed from marketing emails{state.email ? ` for ${state.email}` : ""}. You&apos;ll still
              receive order confirmations and important account emails.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-neutral-900">Unsubscribe link invalid</h1>
            <p className="mt-3 text-sm text-neutral-600">
              This unsubscribe link is invalid or has already been used.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-[var(--theme-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
