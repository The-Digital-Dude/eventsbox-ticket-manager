"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    if (!token) return toast.error("Invalid reset link — no token found");

    setLoading(true);
    const res = await fetch("/api/auth/reset-password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Reset failed. The link may have expired.");
      return;
    }

    setDone(true);
    toast.success("Password updated successfully");
    setTimeout(() => router.push("/auth/login"), 2000);
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Invalid or missing reset token.{" "}
        <Link href="/auth/forgot-password" className="underline">Request a new link.</Link>
      </div>
    );
  }

  return done ? (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Your password has been updated. Redirecting to login...
      </div>
    </div>
  ) : (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm Password</Label>
        <Input
          id="confirm"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat new password"
        />
      </div>
      <Button className="w-full" disabled={loading}>
        {loading ? "Updating..." : "Set New Password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-neutral-100" />}>
            <ResetForm />
          </Suspense>
          <p className="mt-4 text-sm text-neutral-600">
            <Link href="/auth/login" className="font-medium text-[var(--theme-accent)] hover:underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
