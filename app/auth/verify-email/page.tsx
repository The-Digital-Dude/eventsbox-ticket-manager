"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

type Status = "idle" | "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("No verification token found in URL."); return; } // eslint-disable-line react-hooks/set-state-in-effect

    setStatus("verifying");

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.data?.verified) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMsg(payload?.error?.message ?? "Verification failed. The link may have expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Network error. Please try again.");
      });
  }, [token]);

  return (
    <div className="text-center">
      {status === "verifying" || status === "idle" ? (
        <div className="space-y-3">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--theme-accent)] border-t-transparent" />
          <p className="text-neutral-600">Verifying your email...</p>
        </div>
      ) : status === "success" ? (
        <div className="space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <div>
            <p className="text-lg font-semibold text-neutral-900">Email verified!</p>
            <p className="mt-1 text-sm text-neutral-600">Your email address has been confirmed.</p>
          </div>
          <Link href="/auth/login">
            <Button className="w-full">Go to Login</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <div>
            <p className="text-lg font-semibold text-neutral-900">Verification failed</p>
            <p className="mt-1 text-sm text-neutral-600">{errorMsg}</p>
          </div>
          <Link href="/auth/login">
            <Button variant="outline" className="w-full">Back to Login</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Email Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="space-y-3 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--theme-accent)] border-t-transparent" />
              <p className="text-neutral-600">Loading...</p>
            </div>
          }>
            <VerifyEmailContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
