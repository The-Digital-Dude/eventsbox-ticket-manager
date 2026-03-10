"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

function AcceptTransferContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState(
    token ? "Confirming your transfer..." : "This transfer link is missing a token.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    async function acceptTransfer() {
      const response = await fetch("/api/transfer/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!active) {
        return;
      }

      if (!response.ok) {
        setState("error");
        setMessage(payload?.error?.message ?? "This transfer link has expired or is no longer valid.");
        return;
      }

      setState("success");
      setMessage(`Ticket accepted for ${payload.data.eventTitle}. Check your email for the ticket details.`);
    }

    void acceptTransfer();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="rounded-xl border px-4 py-3 text-sm">
      {state === "loading" ? (
        <div className="border-amber-200 bg-amber-50 text-amber-800">{message}</div>
      ) : state === "success" ? (
        <div className="border-emerald-200 bg-emerald-50 text-emerald-800">{message}</div>
      ) : (
        <div className="border-red-200 bg-red-50 text-red-800">{message}</div>
      )}
    </div>
  );
}

export default function TransferAcceptPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept ticket transfer</CardTitle>
          <CardDescription>We&apos;re validating your transfer link now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-neutral-100" />}>
            <AcceptTransferContent />
          </Suspense>
          <p className="text-sm text-neutral-600">
            <Link href="/events" className="font-medium text-[var(--theme-accent)] hover:underline">
              Browse events
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
