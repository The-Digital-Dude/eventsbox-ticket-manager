import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { createNotification } from "@/src/lib/services/notify";
import { sendWaitlistAvailabilityEmail } from "@/src/lib/services/notifications";

export async function notifyWaitlist(ticketTypeId: string, slotsFreed: number): Promise<void> {
  if (slotsFreed <= 0) return;

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: {
      id: true,
      name: true,
      event: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
  });
  if (!ticketType) return;

  const entries = await prisma.waitlist.findMany({
    where: {
      ticketTypeId,
      notifiedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take: slotsFreed,
    select: {
      id: true,
      email: true,
      name: true,
      attendeeProfile: {
        select: {
          userId: true,
        },
      },
    },
  });
  if (entries.length === 0) return;

  const eventUrl = `${env.APP_URL}/events/${ticketType.event.slug}`;

  await Promise.allSettled(
    entries.flatMap((entry) => {
      const tasks: Array<Promise<unknown>> = [
        sendWaitlistAvailabilityEmail({
          to: entry.email,
          name: entry.name,
          ticketName: ticketType.name,
          eventTitle: ticketType.event.title,
          eventUrl,
        }),
      ];

      if (entry.attendeeProfile?.userId) {
        tasks.push(
          createNotification(
            entry.attendeeProfile.userId,
            "WAITLIST_OPEN",
            "Spot available!",
            `${ticketType.name} for ${ticketType.event.title} is available again.`,
            `/events/${ticketType.event.slug}`,
          ),
        );
      }

      return tasks;
    }),
  );

  await prisma.waitlist.updateMany({
    where: { id: { in: entries.map((entry) => entry.id) } },
    data: { notifiedAt: new Date() },
  });
}
