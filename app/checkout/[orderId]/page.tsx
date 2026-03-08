"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Lock, CalendarDays } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";

// Stripe instance (singleton)
const stripePromise = typeof window !== "undefined" && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type OrderSummary = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  subtotal: number;
  platformFee: number;
  gst: number;
  total: number;
  event: {
    title: string;
    startAt: string;
    venue: { name: string } | null;
  };
  items: Array<{
    quantity: number;
    unitPrice: number;
    subtotal: number;
    ticketType: { name: string };
  }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Inner form — must be inside <Elements>
function CheckoutForm({ orderId, total }: { orderId: string; total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [paying, setPaying] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPaying(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders/${orderId}`,
      },
      redirect: "if_required",
    });
    setPaying(false);

    if (error) {
      toast.error(error.message ?? "Payment failed");
      return;
    }

    // If redirect: "if_required" didn't redirect (card confirmed inline)
    toast.success("Payment confirmed!");
    router.push(`/orders/${orderId}`);
  }

  return (
    <form onSubmit={handlePay} className="space-y-6">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button
        type="submit"
        className="w-full gap-2 text-base py-6"
        disabled={!stripe || !elements || paying}
      >
        <Lock className="h-4 w-4" />
        {paying ? "Processing..." : `Pay $${total.toFixed(2)}`}
      </Button>
      <p className="text-center text-xs text-neutral-400">
        Secured by{" "}
        <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="underline">
          Stripe
        </a>. Your card details are never stored on our servers.
      </p>
    </form>
  );
}

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const searchParams = useSearchParams();
  const clientSecret = searchParams.get("cs");
  const router = useRouter();

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((payload) => {
        if (!payload?.data) { router.replace("/events"); return; }
        // If order is already PAID, redirect to confirmation
        if (payload.data.status === "PAID") {
          router.replace(`/orders/${orderId}`);
          return;
        }
        setOrder(payload.data);
        setLoading(false);
      });
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg,#f8f8f8)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--theme-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!order || !clientSecret) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--page-bg,#f8f8f8)] gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-neutral-900">Invalid checkout session</h1>
        <p className="text-neutral-600 max-w-md">Your session may have expired or the payment link is invalid.</p>
        <Link href="/events" className="text-[var(--theme-accent)] underline">Browse Events</Link>
      </div>
    );
  }

  const stripeOptions = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#6366f1",
        borderRadius: "8px",
      },
    },
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(59,130,246)]" />

      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link
          href={`/events/${order.event.title}`}
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 transition"
        >
          ← Back
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Payment form */}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h1 className="mb-6 text-2xl font-bold tracking-tight text-neutral-900">Complete Payment</h1>
            {stripePromise ? (
              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutForm orderId={orderId} total={Number(order.total)} />
              </Elements>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Payment system is not configured. Please contact support.
              </div>
            )}
          </section>

          {/* Order summary */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Order Summary</h2>

              <div className="mb-4 space-y-1">
                <p className="font-medium text-neutral-900">{order.event.title}</p>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(order.event.startAt)}
                </div>
                {order.event.venue && (
                  <p className="text-sm text-neutral-500">{order.event.venue.name}</p>
                )}
              </div>

              <div className="border-t border-[var(--border)] pt-4 space-y-2 text-sm">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-neutral-700">
                    <span>{item.ticketType.name} × {item.quantity}</span>
                    <span>${Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-[var(--border)] pt-2 space-y-1 text-neutral-600">
                  <div className="flex justify-between"><span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Platform fee</span><span>${Number(order.platformFee).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>GST</span><span>${Number(order.gst).toFixed(2)}</span></div>
                </div>
                <div className="border-t border-[var(--border)] pt-2 flex justify-between text-base font-bold text-neutral-900">
                  <span>Total</span>
                  <span>${Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm text-sm">
              <p className="font-medium text-neutral-700">Booking for</p>
              <p className="text-neutral-900">{order.buyerName}</p>
              <p className="text-neutral-500">{order.buyerEmail}</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
