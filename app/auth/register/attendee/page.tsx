"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { PublicNav } from "@/src/components/shared/public-nav";

type ApiResponse = {
  error?: { message?: string };
};

export default function AttendeeRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/register/attendee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName: displayName || undefined }),
      });

      const payload = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setErrorMessage(payload.error?.message ?? "Registration failed");
        return;
      }

      const redirectTarget = searchParams.get("redirect");
      const verifyUrl = new URL("/auth/verify-email", window.location.origin);
      verifyUrl.searchParams.set("email", email);
      if (redirectTarget) {
        verifyUrl.searchParams.set("redirect", redirectTarget);
      }

      router.push(`${verifyUrl.pathname}${verifyUrl.search}`);
    } catch {
      setErrorMessage("Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg)]">
      <PublicNav />
      <main className="mx-auto flex w-full max-w-lg items-center justify-center px-4 py-10">
        <div className="w-full rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-neutral-900">Create Attendee Account</h1>
          <p className="mt-1 text-sm text-neutral-600">Register to track your orders and manage your account.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <Button className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>

          {errorMessage ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}

          <p className="mt-4 text-sm text-neutral-600">
            Already have an account?{" "}
            <Link
              href={
                searchParams.get("redirect")
                  ? `/auth/login?redirect=${encodeURIComponent(searchParams.get("redirect") ?? "")}`
                  : "/auth/login"
              }
              className="font-medium text-[var(--theme-accent)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
