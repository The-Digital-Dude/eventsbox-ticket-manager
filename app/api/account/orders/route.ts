import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { ok, fail } from "@/src/lib/http/response";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { authErrorResponse } from "@/src/lib/auth/error-response";

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  try {
    const session = await requireAttendee(req);
    const profile = await prisma.attendeeProfile.findUnique({ where: { userId: session.user.id } });

    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }

    const pageParam = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const where = {
      attendeeUserId: profile.id,
      status: { in: [OrderStatus.PAID, OrderStatus.REFUNDED] },
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          event: { select: { id: true, title: true, startAt: true, endAt: true, slug: true, cancellationDeadlineHours: true, refundPercent: true } },
          cancellationRequest: {
            select: { id: true, status: true },
          },
          items: {
            select: {
              quantity: true,
              ticketType: { select: { name: true } },
              tickets: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  ticketNumber: true,
                  checkedInAt: true,
                  transfers: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                      toEmail: true,
                      toName: true,
                      expiresAt: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { paidAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.order.count({ where }),
    ]);

    const reviews = await prisma.eventReview.findMany({
      where: {
        attendeeUserId: profile.id,
        eventId: {
          in: orders.map((order) => order.event.id),
        },
      },
      select: {
        id: true,
        eventId: true,
      },
    });

    const reviewByEventId = new Map(reviews.map((review) => [review.eventId, review.id]));

    const mappedOrders = orders.map((order) => ({
      ...order,
      reviewId: reviewByEventId.get(order.event.id) ?? null,
      items: order.items.map((item) => ({
        ...item,
        tickets: item.tickets.map((ticket) => ({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          checkedInAt: ticket.checkedInAt,
          transfer: ticket.transfers[0] ?? null,
        })),
      })),
    }));

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return ok({ orders: mappedOrders, total, pages });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Attendee account required" });
    if (authResponse) return authResponse;

    console.error("[app/api/account/orders/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load orders" });
  }
}
