"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

const OTP_LENGTH = 6;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setCode(next);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleVerify() {
    const fullCode = code.join("");
    if (fullCode.length < OTP_LENGTH) {
      toast.error("Enter the full 6-digit code");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: fullCode }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Invalid or expired code");
      setCode(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      return;
    }

    setVerified(true);
    setTimeout(() => router.push("/auth/login"), 2500);
  }

  async function handleResend() {
    if (!canResend) return;
    setCanResend(false);
    setCountdown(60);
    setCode(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();

    const res = await fetch("/api/auth/verify-email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      toast.success("New code sent to your email");
    } else {
      toast.error("Failed to resend code. Try again.");
    }
  }

  if (verified) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <div>
          <p className="text-lg font-semibold text-neutral-900">Email verified!</p>
          <p className="mt-1 text-sm text-neutral-500">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-center text-sm text-neutral-500">
        Code sent to <span className="font-medium text-neutral-800">{email}</span>
      </p>

      <div className="flex gap-3">
        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={code[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className="h-14 w-12 rounded-xl border border-neutral-200 bg-white text-center text-xl font-bold text-neutral-900 shadow-sm outline-none ring-0 transition focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[var(--theme-accent)]/20 caret-transparent"
          />
        ))}
      </div>

      <Button className="w-full" onClick={handleVerify} disabled={loading || code.join("").length < OTP_LENGTH}>
        {loading ? "Verifying..." : "Verify"}
      </Button>

      <div className="flex items-center gap-4 text-sm text-neutral-500">
        <span>Didn&apos;t receive code?</span>
        <button
          onClick={handleResend}
          disabled={!canResend}
          className="font-medium text-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-40 hover:underline"
        >
          {canResend ? "Resend code" : `Resend in ${String(countdown).padStart(2, "0")}s`}
        </button>
      </div>

      <Link href="/auth/login" className="text-xs text-neutral-400 hover:underline">
        Back to login
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>Enter the 6-digit code we sent you</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--theme-accent)] border-t-transparent" />
            </div>
          }>
            <VerifyEmailContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
