"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<{ email: string; password: string }>({
    resolver: zodResolver(z.object({ email: z.email(), password: z.string().min(8) })),
  });

  async function handleSubmit(values: { email: string; password: string }) {
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Registration failed");
      return;
    }

    router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <div className="grid min-h-screen bg-[var(--page-bg)] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-[var(--theme-accent)] p-10 text-white lg:flex">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">EventsBox</p>
          <h1 className="max-w-md text-4xl font-semibold leading-tight">Create your organizer workspace account.</h1>
          <p className="max-w-md text-sm leading-relaxed text-white/85">
            Register once, complete onboarding, and submit venues with structured approval workflows.
          </p>
        </div>
        <p className="text-xs text-white/70">Use a valid business email and secure password.</p>
      </section>

      <section className="flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Organizer Account</CardTitle>
            <CardDescription>Start onboarding for EventsBox platform access.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required {...form.register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={8} {...form.register("password")} />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-sm text-neutral-600">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-[var(--theme-accent)] hover:underline">
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
