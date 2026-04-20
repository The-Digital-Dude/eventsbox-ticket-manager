import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { getTicketSeatingSectionKey, resolveEventSeating } from "@/src/lib/event-seating";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";
import { checkoutIntentSchema } from "@/src/lib/validators/event";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { validatePromoCodeById } from "@/src/lib/services/promo-code";
import { getSeatDescriptorMap } from "@/src/lib/venue-seating";

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

    const { eventId, buyerName, buyerEmail, items, promoCodeId, affiliateCode, selectedSeatIds = [], addOns = [], isWalkIn, scannerId } = parsed.data;

    if (isWalkIn) {
      if (!scannerId) return fail(400, { code: "SCANNER_ID_REQUIRED", message: "Scanner ID is required for walk-in orders" });
      const scanner = await prisma.scannerProfile.findUnique({ where: { id: scannerId }, include: { user: true } });
      if (!scanner || !scanner.user.isActive) return fail(403, { code: "INVALID_SCANNER", message: "Scanner account is not active" });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, status: "PUBLISHED" },
      include: {
        ticketTypes: {
          include: {
            eventSeatingSection: {
              select: {
                key: true,
              },
            },
          },
        },
        seatingPlan: {
          select: {
            seatingConfig: true,
            seatState: true,
            sections: {
              select: {
                key: true,
                name: true,
              },
            },
          },
        },
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

    const organizerPayoutSettings = await prisma.organizerPayoutSettings.findUnique({
      where: { organizerProfileId: event.organizerProfileId },
      select: {
        stripeAccountId: true,
        stripeOnboardingStatus: true,
        payoutMode: true,
      },
    });

    const connectedAccountId =
      organizerPayoutSettings?.payoutMode !== "MANUAL" &&
      organizerPayoutSettings?.stripeOnboardingStatus === "COMPLETED" &&
      organizerPayoutSettings?.stripeAccountId
        ? organizerPayoutSettings.stripeAccountId
        : null;

    const uniqueSelectedSeatIds = Array.from(new Set(selectedSeatIds));
    const resolvedSeating = resolveEventSeating(event);
    const seatingConfig = resolvedSeating.seatingConfig;
    const seatState = resolvedSeating.seatState;
    const seatDescriptorMap = seatingConfig ? getSeatDescriptorMap(seatingConfig, seatState) : {};

    if (selectedSeatIds.length !== uniqueSelectedSeatIds.length) {
      return fail(400, {
        code: "DUPLICATE_SEAT_SELECTION",
        message: "Each selected seat must be unique",
      });
    }

    if (seatingConfig) {
      // Only ticket types linked to a section require seat selection
      const totalSeatedTickets = items.reduce((sum, item) => {
        const tt = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
        return getTicketSeatingSectionKey(tt ?? {}) ? sum + item.quantity : sum;
      }, 0);

      if (uniqueSelectedSeatIds.length !== totalSeatedTickets) {
        return fail(400, {
          code: "SEAT_SELECTION_REQUIRED",
          message: `Select ${totalSeatedTickets} seat${totalSeatedTickets === 1 ? "" : "s"} before checkout`,
        });
      }

      const invalidSeatId = uniqueSelectedSeatIds.find((seatId) => !seatDescriptorMap[seatId]);
      if (invalidSeatId) {
        return fail(400, {
          code: "INVALID_SEAT",
          message: `Seat ${invalidSeatId} is not available for this event`,
        });
      }

      // Each section must get exactly the right number of seats
      const sectionRequired = new Map<string, number>();
      for (const item of items) {
        const tt = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
        const sectionKey = getTicketSeatingSectionKey(tt ?? {});
        if (sectionKey) {
          sectionRequired.set(sectionKey, (sectionRequired.get(sectionKey) ?? 0) + item.quantity);
        }
      }

      const sectionSelected = new Map<string, number>();
      for (const seatId of uniqueSelectedSeatIds) {
        const descriptor = seatDescriptorMap[seatId];
        if (descriptor) {
          sectionSelected.set(descriptor.sectionId, (sectionSelected.get(descriptor.sectionId) ?? 0) + 1);
        }
      }

      for (const [sectionId, required] of sectionRequired) {
        const selected = sectionSelected.get(sectionId) ?? 0;
        if (selected !== required) {
          return fail(400, {
            code: "SEAT_SECTION_MISMATCH",
            message: `Please select ${required} seat${required === 1 ? "" : "s"} from the correct section`,
          });
        }
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
        include: { ticketTypes: true, addOns: true },
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

        const available = ticketType.quantity - ticketType.sold - ticketType.reservedQty;
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

      const resolvedAddOns: Array<{
        addOn: typeof freshEvent.addOns[number];
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      for (const ao of addOns) {
        const addOn = freshEvent.addOns.find((entry) => entry.id === ao.addOnId && entry.isActive);
        if (!addOn) {
          throw new Error(`INVALID_ADDON:${ao.addOnId}`);
        }

        if (ao.quantity > addOn.maxPerOrder) {
          throw new Error(`EXCEEDS_MAX_ADDON:${addOn.name}:${addOn.maxPerOrder}`);
        }

        if (addOn.totalStock !== null) {
          const agg = await tx.orderAddOn.aggregate({
            where: { addOnId: addOn.id, order: { status: "PAID" } },
            _sum: { quantity: true },
          });
          const sold = agg._sum.quantity || 0;
          if (sold + ao.quantity > addOn.totalStock) {
            const available = Math.max(0, addOn.totalStock - sold);
            throw new Error(`INSUFFICIENT_ADDON_INVENTORY:${addOn.name}:${available}`);
          }
        }

        const unitPrice = Number(addOn.price);
        const itemSubtotal = unitPrice * ao.quantity;
        subtotal += itemSubtotal;
        resolvedAddOns.push({
          addOn,
          quantity: ao.quantity,
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

      let affiliateLinkId: string | undefined;
      if (affiliateCode) {
        const link = await tx.affiliateLink.findFirst({
          where: { code: affiliateCode, isActive: true },
          select: { id: true },
        });
        if (link) affiliateLinkId = link.id;
      }

      const createdOrder = await tx.order.create({
        data: {
          eventId,
          buyerName,
          buyerEmail,
          subtotal,
          discountAmount,
          promoCodeId: promoCodeRecordId,
          affiliateLinkId,
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
          orderAddOns: {
            create: resolvedAddOns.map((resolved) => ({
              addOnId: resolved.addOn.id,
              name: resolved.addOn.name,
              quantity: resolved.quantity,
              unitPrice: resolved.unitPrice,
              subtotal: resolved.subtotal,
            })),
          },
        },
        include: { items: true, orderAddOns: true },
      });

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
    }, { maxWait: 15000, timeout: 15000 });

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

    const platformFeeAmount = Math.round(Number(order.platformFee) * 100);
    const totalAmountCents = Math.round(Number(order.total) * 100);

    const intent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "nzd",
      metadata: { orderId: order.id, eventId, buyerEmail },
      receipt_email: buyerEmail,
      ...(connectedAccountId && platformFeeAmount > 0
        ? {
            application_fee_amount: platformFeeAmount,
            transfer_data: { destination: connectedAccountId },
          }
        : {}),
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
      if (code === "INVALID_ADDON") {
        return fail(400, {
          code: "INVALID_ADDON",
          message: `Add-on ${detail} not found or inactive`,
        });
      }
      if (code === "INSUFFICIENT_ADDON_INVENTORY") {
        return fail(400, {
          code: "INSUFFICIENT_ADDON_INVENTORY",
          message: `Only ${extra} available for add-on "${detail}"`,
        });
      }
      if (code === "EXCEEDS_MAX_ADDON") {
        return fail(400, {
          code: "EXCEEDS_MAX_ADDON",
          message: `Maximum ${extra} allowed per order for add-on "${detail}"`,
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
