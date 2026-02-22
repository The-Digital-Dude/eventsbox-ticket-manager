"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
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

    setVerifyToken(payload.data.verifyTokenDev);
    toast.success("Registration successful. You can login now.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
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
          {verifyToken ? <p className="mt-3 text-xs text-neutral-600">Dev verify token: {verifyToken}</p> : null}
          <p className="mt-4 text-sm text-neutral-600">
            Already have an account? <Link href="/auth/login" className="font-medium text-neutral-900">Login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
