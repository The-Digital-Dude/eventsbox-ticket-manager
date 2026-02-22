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

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<{ email: string; password: string }>({
    resolver: zodResolver(z.object({ email: z.email(), password: z.string().min(8) })),
  });

  async function handleSubmit(values: { email: string; password: string }) {
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Login failed");
      return;
    }

    toast.success("Welcome back");
    if (payload.data.role === "SUPER_ADMIN") {
      router.push("/admin/organizers");
    } else {
      router.push("/organizer/status");
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access organizer or admin workspace.</CardDescription>
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
              {loading ? "Signing in..." : "Login"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-neutral-600">
            New organizer? <Link href="/auth/register" className="font-medium text-neutral-900">Create account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
