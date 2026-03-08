import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";
import { checkoutIntentSchema } from "@/src/lib/validators/event";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { validatePromoCodeById } from "@/src/lib/services/promo-code";

export async function POST(req: NextRequest) {
  try {
    const parsed = checkoutIntentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid checkout data", details: parsed.error.flatten() });
    }

    const { eventId, buyerName, buyerEmail, items, promoCodeId } = parsed.data;

    const event = await prisma.event.findFirst({
      where: { id: eventId, status: "PUBLISHED" },
      include: { ticketTypes: true },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found or not available" });

    // Validate each item and compute totals
    let subtotal = 0;
    const resolvedItems: Array<{
      ticketType: typeof event.ticketTypes[number];
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const tt = event.ticketTypes.find((t) => t.id === item.ticketTypeId && t.isActive);
      if (!tt) return fail(400, { code: "INVALID_TICKET", message: `Ticket type ${item.ticketTypeId} not found or inactive` });

      const available = tt.quantity - tt.sold;
      if (item.quantity > available) {
        return fail(400, { code: "INSUFFICIENT_INVENTORY", message: `Only ${available} tickets available for "${tt.name}"` });
      }
      if (item.quantity > tt.maxPerOrder) {
        return fail(400, { code: "EXCEEDS_MAX", message: `Maximum ${tt.maxPerOrder} tickets per order for "${tt.name}"` });
      }

      const unitPrice = Number(tt.price);
      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;
      resolvedItems.push({ ticketType: tt, quantity: item.quantity, unitPrice, subtotal: itemSubtotal });
    }

    const commissionPct = Number(event.commissionPct);
    const gstPct = Number(event.gstPct);
    const platformFeeFixed = Number(event.platformFeeFixed);

    let promoCodeRecordId: string | undefined;
    let discountAmount = 0;

    if (promoCodeId) {
      const promoCheck = await validatePromoCodeById({ promoCodeId, eventId });
      if (!promoCheck.valid) {
        return fail(400, { code: "INVALID_PROMO", message: promoCheck.message });
      }

      promoCodeRecordId = promoCheck.promoCode.id;
      const promoDiscountValue = Number(promoCheck.promoCode.discountValue);
      if (promoCheck.promoCode.discountType === "PERCENTAGE") {
        discountAmount = subtotal * (promoDiscountValue / 100);
      } else {
        discountAmount = Math.min(promoDiscountValue, subtotal);
      }
      discountAmount = parseFloat(discountAmount.toFixed(2));
    }

    const discountedSubtotal = parseFloat(Math.max(0, subtotal - discountAmount).toFixed(2));
    const platformFee = parseFloat((discountedSubtotal * (commissionPct / 100) + platformFeeFixed).toFixed(2));
    const gst = parseFloat(((discountedSubtotal + platformFee) * (gstPct / 100)).toFixed(2));
    const total = parseFloat((discountedSubtotal + platformFee + gst).toFixed(2));

    const stripe = getStripeClient();
    if (!stripe) {
      return fail(500, { code: "STRIPE_UNAVAILABLE", message: "Payment system unavailable" });
    }

    // Create pending order
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          eventId,
          buyerName,
          buyerEmail,
          subtotal,
          discountAmount,
          promoCodeId: promoCodeRecordId,
          platformFee,
          gst,
          total,
          status: "PENDING",
          items: {
            create: resolvedItems.map((ri) => ({
              ticketTypeId: ri.ticketType.id,
              quantity: ri.quantity,
              unitPrice: ri.unitPrice,
              subtotal: ri.subtotal,
            })),
          },
        },
        include: { items: true },
      });

      if (promoCodeRecordId) {
        await tx.promoCode.update({
          where: { id: promoCodeRecordId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return createdOrder;
    });

    // Link order to attendee account if logged in
    const session = await getServerSession();
    if (session && session.user.role === "ATTENDEE") {
      const attendeeProfile = await prisma.attendeeProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (attendeeProfile) {
        await prisma.order.update({
          where: { id: order.id },
          data: { attendeeUserId: attendeeProfile.id },
        });
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "nzd",
      metadata: { orderId: order.id, eventId, buyerEmail },
      receipt_email: buyerEmail,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    });

    return ok({
      orderId: order.id,
      clientSecret: intent.client_secret,
      summary: { subtotal, discountAmount, discountedSubtotal, platformFee, gst, total },
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return fail(500, { code: "INTERNAL_ERROR", message: "Checkout failed" });
  }
}
