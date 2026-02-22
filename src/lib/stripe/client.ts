import Stripe from "stripe";
import { env } from "@/src/lib/env";

export function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-01-28.clover",
  });
}
