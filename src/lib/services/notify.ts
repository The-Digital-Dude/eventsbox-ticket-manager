import { prisma } from "@/src/lib/db";

export type NotificationType =
  | "ORDER_CONFIRMED"
  | "EVENT_REMINDER"
  | "WAITLIST_OPEN"
  | "REVIEW_PROMPT"
  | "SYSTEM";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  actionUrl?: string,
) {
  return prisma.notification.create({
    data: { userId, type, title, body, actionUrl },
  });
}
