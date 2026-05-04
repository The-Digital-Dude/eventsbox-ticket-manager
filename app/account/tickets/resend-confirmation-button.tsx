"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

export function ResendConfirmationButton({ orderId }: { orderId: string }) {
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    const res = await fetch(`/api/account/orders/${orderId}/resend-confirmation`, { method: "POST" });
    const payload = await res.json();
    setSending(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to resend confirmation email");
      return;
    }

    toast.success("Confirmation email sent");
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={sending}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
    >
      <Mail className="h-4 w-4" />
      {sending ? "Sending..." : "Resend email"}
    </button>
  );
}
