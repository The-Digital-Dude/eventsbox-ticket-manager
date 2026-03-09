import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";
import { checkoutIntentSchema } from "@/src/lib/validators/event";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { validatePromoCodeById } from "@/src/lib/services/promo-code";
import { getSeatDescriptorMap } from "@/src/lib/venue-seating";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

const SEAT_HOLD_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const parsed = checkoutIntentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid checkout data",
        details: parsed.error.flatten(),
      });
    }

    const { eventId, buyerName, buyerEmail, items, promoCodeId, selectedSeatIds = [] } = parsed.data;

    const event = await prisma.event.findFirst({
      where: { id: eventId, status: "PUBLISHED" },
      include: {
        ticketTypes: true,
        venue: {
          select: {
            seatingConfig: true,
            seatState: true,
          },
        },
      },
    });
    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found or not available" });
    }

    const totalRequestedTickets = items.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueSelectedSeatIds = Array.from(new Set(selectedSeatIds));
    const seatingConfig = (event.venue?.seatingConfig as VenueSeatingConfig | null) ?? null;
    const seatState = (event.venue?.seatState as Record<string, SeatState> | null) ?? null;
    const seatDescriptorMap = seatingConfig ? getSeatDescriptorMap(seatingConfig, seatState) : {};

    if (selectedSeatIds.length !== uniqueSelectedSeatIds.length) {
      return fail(400, {
        code: "DUPLICATE_SEAT_SELECTION",
        message: "Each selected seat must be unique",
      });
    }

    if (seatingConfig) {
      if (uniqueSelectedSeatIds.length !== totalRequestedTickets) {
        return fail(400, {
          code: "SEAT_SELECTION_REQUIRED",
          message: `Select ${totalRequestedTickets} seat${totalRequestedTickets === 1 ? "" : "s"} before checkout`,
        });
      }

      const invalidSeatId = uniqueSelectedSeatIds.find((seatId) => !seatDescriptorMap[seatId]);
      if (invalidSeatId) {
        return fail(400, {
          code: "INVALID_SEAT",
          message: `Seat ${invalidSeatId} is not available for this venue`,
        });
      }
    } else if (uniqueSelectedSeatIds.length > 0) {
      return fail(400, {
        code: "SEATING_NOT_ENABLED",
        message: "This event does not support reserved seating",
      });
    }

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
        discountAmount = event.ticketTypes.reduce((sum, ticketType) => {
          const matchingItem = items.find((item) => item.ticketTypeId === ticketType.id);
          if (!matchingItem) return sum;
          return sum + Number(ticketType.price) * matchingItem.quantity;
        }, 0) * (promoDiscountValue / 100);
      } else {
        const subtotal = event.ticketTypes.reduce((sum, ticketType) => {
          const matchingItem = items.find((item) => item.ticketTypeId === ticketType.id);
          if (!matchingItem) return sum;
          return sum + Number(ticketType.price) * matchingItem.quantity;
        }, 0);
        discountAmount = Math.min(promoDiscountValue, subtotal);
      }
      discountAmount = parseFloat(discountAmount.toFixed(2));
    }

    const now = new Date();
    const holdUntil = new Date(now.getTime() + SEAT_HOLD_MS);

    const order = await prisma.$transaction(async (tx) => {
      await tx.eventSeatBooking.deleteMany({
        where: {
          eventId,
          status: "RESERVED",
          expiresAt: { lt: now },
        },
      });

      const freshEvent = await tx.event.findFirst({
        where: { id: eventId, status: "PUBLISHED" },
        include: { ticketTypes: true },
      });
      if (!freshEvent) {
        throw new Error("EVENT_NOT_AVAILABLE");
      }

      let subtotal = 0;
      const resolvedItems: Array<{
        ticketType: typeof freshEvent.ticketTypes[number];
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      for (const item of items) {
        const ticketType = freshEvent.ticketTypes.find(
          (entry) => entry.id === item.ticketTypeId && entry.isActive,
        );
        if (!ticketType) {
          throw new Error(`INVALID_TICKET:${item.ticketTypeId}`);
        }

        const available = ticketType.quantity - ticketType.sold;
        if (item.quantity > available) {
          throw new Error(`INSUFFICIENT_INVENTORY:${ticketType.name}:${available}`);
        }
        if (item.quantity > ticketType.maxPerOrder) {
          throw new Error(`EXCEEDS_MAX:${ticketType.name}:${ticketType.maxPerOrder}`);
        }

        const unitPrice = Number(ticketType.price);
        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;
        resolvedItems.push({
          ticketType,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemSubtotal,
        });
      }

      const discountedSubtotal = parseFloat(Math.max(0, subtotal - discountAmount).toFixed(2));
      const platformFee = parseFloat(
        (discountedSubtotal * (Number(freshEvent.commissionPct) / 100) + Number(freshEvent.platformFeeFixed)).toFixed(2),
      );
      const gst = parseFloat(
        ((discountedSubtotal + platformFee) * (Number(freshEvent.gstPct) / 100)).toFixed(2),
      );
      const total = parseFloat((discountedSubtotal + platformFee + gst).toFixed(2));

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
            create: resolvedItems.map((resolved) => ({
              ticketTypeId: resolved.ticketType.id,
              quantity: resolved.quantity,
              unitPrice: resolved.unitPrice,
              subtotal: resolved.subtotal,
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

      if (seatingConfig) {
        for (const seatId of uniqueSelectedSeatIds) {
          try {
            await tx.eventSeatBooking.create({
              data: {
                eventId,
                orderId: createdOrder.id,
                seatId,
                seatLabel: seatDescriptorMap[seatId].seatLabel,
                status: "RESERVED",
                expiresAt: holdUntil,
              },
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              throw new Error(`SEAT_ALREADY_RESERVED:${seatId}`);
            }
            throw error;
          }
        }
      }

      return createdOrder;
    });

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
      } else {
        console.warn(
          `[checkout] ATTENDEE session ${session.user.id} has no attendeeProfile — order ${order.id} not linked`,
        );
      }
    }

    const stripe = getStripeClient();
    if (!stripe) {
      await prisma.eventSeatBooking.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
      return fail(500, {
        code: "STRIPE_UNAVAILABLE",
        message: "Payment system unavailable",
      });
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(order.total) * 100),
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
      summary: {
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        discountedSubtotal: Number(order.subtotal) - Number(order.discountAmount),
        platformFee: Number(order.platformFee),
        gst: Number(order.gst),
        total: Number(order.total),
      },
      seatHoldExpiresAt: seatingConfig ? holdUntil.toISOString() : null,
    });
  } catch (err) {
    if (err instanceof Error) {
      const [code, detail, extra] = err.message.split(":");
      if (code === "INVALID_TICKET") {
        return fail(400, {
          code: "INVALID_TICKET",
          message: `Ticket type ${detail} not found or inactive`,
        });
      }
      if (code === "INSUFFICIENT_INVENTORY") {
        return fail(400, {
          code: "INSUFFICIENT_INVENTORY",
          message: `Only ${extra} tickets available for "${detail}"`,
        });
      }
      if (code === "EXCEEDS_MAX") {
        return fail(400, {
          code: "EXCEEDS_MAX",
          message: `Maximum ${extra} tickets per order for "${detail}"`,
        });
      }
      if (code === "SEAT_ALREADY_RESERVED") {
        return fail(409, {
          code: "SEAT_ALREADY_RESERVED",
          message: `Seat ${detail} was just taken. Please choose another seat.`,
        });
      }
      if (code === "EVENT_NOT_AVAILABLE") {
        return fail(404, {
          code: "NOT_FOUND",
          message: "Event not found or not available",
        });
      }
    }

    console.error("Checkout error:", err);
    return fail(500, { code: "INTERNAL_ERROR", message: "Checkout failed" });
  }
}
