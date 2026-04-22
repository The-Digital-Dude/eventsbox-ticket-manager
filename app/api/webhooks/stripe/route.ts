import { NextRequest } from "next/server";
import { StripeOnboardingStatus } from "@prisma/client";
import Stripe from "stripe";
import { fail, ok } from "@/src/lib/http/response";
import { env } from "@/src/lib/env";
import { getStripeClient } from "@/src/lib/stripe/client";
import { prisma } from "@/src/lib/db";
import { sendOrderConfirmationEmail } from "@/src/lib/services/notifications";
import { createNotification } from "@/src/lib/services/notify";
import {
  markSeatBookingsBooked,
  releaseSeatBookingsForOrder,
} from "@/src/lib/services/seat-booking";
import { notifyWaitlist } from "@/src/lib/services/waitlist";

type WebhookTicketType = {
  classType?: string | null;
  sourceSeatingSectionId?: string | null;
  eventSeatingSectionId?: string | null;
  sectionId?: string | null;
};

function getTicketSectionId(ticketType: WebhookTicketType) {
  return (
    ticketType.eventSeatingSectionId ??
    ticketType.sourceSeatingSectionId ??
    ticketType.sectionId ??
    null
  );
}

function ticketRequiresSeatSelection(ticketType: WebhookTicketType) {
  return (
    ticketType.classType === "ASSIGNED_SEAT" ||
    ticketType.classType === "TABLE" ||
    Boolean(getTicketSectionId(ticketType))
  );
}

function getWebhookSecrets() {
  return [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );
}

function constructEventWithKnownSecrets(stripe: Stripe, body: string, signature: string) {
  const secrets = getWebhookSecrets();
  let lastSignatureError: Error | null = null;

  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        lastSignatureError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastSignatureError ?? new Error("No Stripe webhook secrets configured");
}

async function syncConnectedAccount(account: Stripe.Account) {
  if (!account.id) {
    return;
  }

  const stripeOnboardingStatus =
    account.details_submitted || (account.charges_enabled && account.payouts_enabled)
      ? StripeOnboardingStatus.COMPLETED
      : StripeOnboardingStatus.PENDING;

  await prisma.organizerPayoutSettings.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      stripeOnboardingStatus,
    },
  });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await syncConnectedAccount(account);
      return;
    }
    case "account.application.deauthorized": {
      if (!event.account) {
        return;
      }

      await prisma.organizerPayoutSettings.updateMany({
        where: { stripeAccountId: event.account },
        data: {
          stripeAccountId: null,
          stripeOnboardingStatus: StripeOnboardingStatus.NOT_STARTED,
          payoutMode: "MANUAL",
        },
      });
      return;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentSucceeded(intent);
      return;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const failedOrders = await prisma.order.findMany({
        where: { stripePaymentIntentId: intent.id, status: "PENDING" },
        select: { id: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({
          where: { stripePaymentIntentId: intent.id, status: "PENDING" },
          data: { status: "FAILED" },
        });

        for (const order of failedOrders) {
          await releaseSeatBookingsForOrder(tx, order.id);
        }
      });
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(charge);
      return;
    }
    default:
      return;
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, status: "PAID" },
    select: {
      id: true,
      items: {
        select: {
          ticketTypeId: true,
          quantity: true,
        },
      },
    },
  });
  if (!order) return;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    });

    await releaseSeatBookingsForOrder(tx, order.id);

    for (const item of order.items) {
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { sold: { decrement: item.quantity } },
      });
    }
  });

  for (const item of order.items) {
    void notifyWaitlist(item.ticketTypeId, item.quantity).catch((error) => {
      console.error("[app/api/webhooks/stripe/route.ts][notifyWaitlist]", error);
    });
  }
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: intent.id, status: "PENDING" },
    include: {
      event: {
        select: {
          title: true,
          startAt: true,
          timezone: true,
          customConfirmationMessage: true,
          venue: {
            select: {
              name: true,
            },
          },
        },
      },
      items: { include: { ticketType: true } },
    },
  });
  if (!order) return;

  // Mark order paid and increment sold counts
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (order.promoCodeId) {
      await tx.$executeRaw`
        UPDATE "PromoCode"
        SET "usedCount" = "usedCount" + 1
        WHERE id = ${order.promoCodeId}
          AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
      `;
    }

    const seatBookings = await markSeatBookingsBooked(tx, order.id);

    let seatCursor = 0;
    for (const item of order.items) {
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { sold: { increment: item.quantity } },
      });

      for (let index = 0; index < item.quantity; index += 1) {
        const seatBooking = ticketRequiresSeatSelection(item.ticketType)
          ? seatBookings[seatCursor] ?? null
          : null;
        if (ticketRequiresSeatSelection(item.ticketType)) {
          seatCursor += 1;
        }

        await tx.qRTicket.create({
          data: {
            orderId: order.id,
            orderItemId: item.id,
            ticketNumber: `${order.id.slice(-6).toUpperCase()}-${item.ticketType.name.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
            seatId: seatBooking?.seatId ?? null,
            seatLabel: seatBooking?.seatLabel ?? null,
          },
        });
      }
    }
  });

  const paidOrder = await prisma.order.findUnique({
    where: { id: order.id },
    select: {
      buyerEmail: true,
      buyerName: true,
      event: {
        select: {
          title: true,
          startAt: true,
          timezone: true,
          customConfirmationMessage: true,
          venue: {
            select: {
              name: true,
            },
          },
        },
      },
      tickets: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          ticketNumber: true,
          seatLabel: true,
          orderItem: {
            select: {
              ticketType: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!paidOrder) return;

  try {
    const emailResult = await sendOrderConfirmationEmail({
      to: paidOrder.buyerEmail,
      buyerName: paidOrder.buyerName,
      orderId: order.id,
      eventTitle: paidOrder.event.title,
      startAt: paidOrder.event.startAt,
      timezone: paidOrder.event.timezone,
      venueName: paidOrder.event.venue?.name ?? null,
      tickets: paidOrder.tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketTypeName: ticket.orderItem.ticketType.name,
      })),
      orderUrl: `${env.APP_URL}/orders/${order.id}`,
      customMessage: paidOrder.event.customConfirmationMessage,
    });

    if (!emailResult.sent) {
      console.error("[app/api/webhooks/stripe/route.ts][sendOrderConfirmationEmail]", emailResult);
    }
  } catch (error) {
    console.error("[app/api/webhooks/stripe/route.ts][sendOrderConfirmationEmail]", error);
  }

  if (order.attendeeUserId) {
    const attendeeProfile = await prisma.attendeeProfile.findUnique({
      where: { id: order.attendeeUserId },
      select: { userId: true },
    });

    if (attendeeProfile) {
      await createNotification(
        attendeeProfile.userId,
        "ORDER_CONFIRMED",
        "Booking confirmed!",
        `Your tickets for ${paidOrder.event.title} are ready.`,
        "/account/tickets",
      ).catch(() => {});
    }
  }
}

export async function GET() {
  const stripe = getStripeClient();
  const recentEvents = await prisma.stripeWebhookEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      stripeEventId: true,
      type: true,
      livemode: true,
      processedAt: true,
      lastError: true,
      createdAt: true,
    },
  });

  return ok({
    stripeConfigured: Boolean(stripe),
    webhookSecretConfigured: getWebhookSecrets().length > 0,
    webhookSecretCount: getWebhookSecrets().length,
    endpoint: "/api/webhooks/stripe",
    recentEvents,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  if (!stripe || getWebhookSecrets().length === 0) {
    return ok({ received: true, mocked: true });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return fail(400, { code: "MISSING_SIGNATURE", message: "Missing stripe signature" });
    }

    const event = constructEventWithKnownSecrets(stripe, body, signature);
    const existing = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true, processedAt: true },
    });

    if (existing?.processedAt) {
      return ok({ received: true, duplicate: true, eventId: event.id });
    }

    await prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: {
        type: event.type,
        livemode: event.livemode,
        payload: event as unknown as object,
        lastError: null,
      },
      create: {
        stripeEventId: event.id,
        type: event.type,
        livemode: event.livemode,
        payload: event as unknown as object,
      },
    });

    await handleStripeEvent(event);

    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        processedAt: new Date(),
        lastError: null,
      },
    });

    return ok({ received: true, eventId: event.id });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return fail(400, { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" });
    }

    const maybeEventId =
      typeof error === "object" &&
      error !== null &&
      "raw" in error &&
      typeof (error as { raw?: { id?: string } }).raw?.id === "string"
        ? (error as { raw?: { id?: string } }).raw?.id
        : undefined;

    if (maybeEventId) {
      await prisma.stripeWebhookEvent.updateMany({
        where: { stripeEventId: maybeEventId },
        data: {
          lastError: error instanceof Error ? error.message : "Unknown webhook processing error",
        },
      });
    }

    console.error("Stripe webhook processing error:", error);
    return fail(500, {
      code: "WEBHOOK_PROCESSING_FAILED",
      message: error instanceof Error ? error.message : "Stripe webhook processing failed",
    });
  }
}
