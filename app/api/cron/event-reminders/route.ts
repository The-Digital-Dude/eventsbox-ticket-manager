import { NextRequest } from "next/server";
import { EventStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { createNotification } from "@/src/lib/services/notify";
import { sendEventReminderEmail } from "@/src/lib/services/notifications";

function isAuthorizedCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCron(req)) {
      return fail(401, { code: "UNAUTHORIZED", message: "Cron authorization failed" });
    }

    const now = Date.now();
    const windowStart = new Date(now + 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now + 48 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        reminderSentAt: null,
        event: {
          startAt: { gte: windowStart, lte: windowEnd },
          status: EventStatus.PUBLISHED,
        },
      },
      include: {
        attendeeProfile: {
          select: {
            userId: true,
          },
        },
        event: {
          include: {
            venue: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: 200,
    });

    let reminders = 0;

    for (const order of orders) {
      try {
        await sendEventReminderEmail({
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          eventTitle: order.event.title,
          eventStartAt: order.event.startAt,
          venueName: order.event.venue?.name ?? "Venue TBA",
          orderId: order.id,
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { reminderSentAt: new Date() },
        });

        if (order.attendeeProfile?.userId) {
          await createNotification(
            order.attendeeProfile.userId,
            "EVENT_REMINDER",
            "Your event is tomorrow!",
            `${order.event.title} starts tomorrow.`,
            `/orders/${order.id}`,
          ).catch(() => {});
        }
        reminders += 1;
      } catch (error) {
        console.error("[app/api/cron/event-reminders/route.ts] reminder send failed", {
          orderId: order.id,
          error,
        });
      }
    }

    return ok({ reminders });
  } catch (error) {
    console.error("[app/api/cron/event-reminders/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to send event reminders" });
  }
}
