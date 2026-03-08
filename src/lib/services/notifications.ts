import { Resend } from "resend";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

let resendClient: Resend | null | undefined;

function getResendClient() {
  if (resendClient !== undefined) return resendClient;
  resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  return resendClient;
}

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendEmail(payload: EmailPayload) {
  const client = getResendClient();
  if (!client || !env.EMAIL_FROM) {
    return { sent: false, skipped: true as const };
  }

  try {
    await client.emails.send({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
    });
    return { sent: true, skipped: false as const };
  } catch (error) {
    console.error("Email send failed:", error);
    return { sent: false, skipped: false as const };
  }
}

export async function sendOrderConfirmationEmail(input: {
  to: string;
  buyerName: string;
  orderId: string;
  eventTitle: string;
  startAt: Date;
  timezone: string;
  orderTotal: number;
  ticketLines: string[];
  orderUrl: string;
}) {
  const subject = `Order confirmed: ${input.eventTitle}`;
  const text = [
    `Hi ${input.buyerName},`,
    "",
    `Your order (${input.orderId}) is confirmed for ${input.eventTitle}.`,
    `Date: ${new Date(input.startAt).toLocaleString()} (${input.timezone})`,
    `Tickets: ${input.ticketLines.join(", ")}`,
    `Total: $${input.orderTotal.toFixed(2)}`,
    "",
    `View your tickets: ${input.orderUrl}`,
    "",
    "Thanks for booking with EventsBox.",
  ].join("\n");

  const html = `
    <p>Hi ${input.buyerName},</p>
    <p>Your order (<strong>${input.orderId}</strong>) is confirmed for <strong>${input.eventTitle}</strong>.</p>
    <p>
      Date: ${new Date(input.startAt).toLocaleString()} (${input.timezone})<br/>
      Tickets: ${input.ticketLines.join(", ")}<br/>
      Total: $${input.orderTotal.toFixed(2)}
    </p>
    <p><a href="${input.orderUrl}">View your tickets</a></p>
    <p>Thanks for booking with EventsBox.</p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendOrganizerEventStatusEmail(input: {
  to: string;
  eventTitle: string;
  status: "PUBLISHED" | "REJECTED" | "CANCELLED";
  reason?: string | null;
  eventUrl: string;
}) {
  const statusLabel = input.status.replace("_", " ");
  const subject = `Event ${statusLabel.toLowerCase()}: ${input.eventTitle}`;
  const text = [
    "Hello,",
    "",
    `Your event "${input.eventTitle}" is now ${statusLabel}.`,
    ...(input.reason ? [`Reason: ${input.reason}`] : []),
    "",
    `View event: ${input.eventUrl}`,
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>Your event "<strong>${input.eventTitle}</strong>" is now <strong>${statusLabel}</strong>.</p>
    ${input.reason ? `<p>Reason: ${input.reason}</p>` : ""}
    <p><a href="${input.eventUrl}">View event</a></p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendEventCancelledEmailToAttendee(input: {
  to: string;
  buyerName: string;
  eventTitle: string;
  startAt: Date;
  timezone: string;
}) {
  const subject = `Event cancelled: ${input.eventTitle}`;
  const text = [
    `Hi ${input.buyerName},`,
    "",
    `We are sorry, "${input.eventTitle}" has been cancelled.`,
    `Original date: ${new Date(input.startAt).toLocaleString()} (${input.timezone})`,
    "",
    "If you have a paid order, refund processing will be handled by the organizer/admin.",
  ].join("\n");

  const html = `
    <p>Hi ${input.buyerName},</p>
    <p>We are sorry, "<strong>${input.eventTitle}</strong>" has been cancelled.</p>
    <p>Original date: ${new Date(input.startAt).toLocaleString()} (${input.timezone})</p>
    <p>If you have a paid order, refund processing will be handled by the organizer/admin.</p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function notifyAttendeesOfEventCancellation(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      title: true,
      startAt: true,
      timezone: true,
      orders: {
        where: { status: "PAID" },
        select: { buyerEmail: true, buyerName: true },
      },
    },
  });

  if (!event) return { recipients: 0, sent: 0 };

  const recipients = new Map<string, string>();
  for (const order of event.orders) {
    if (!recipients.has(order.buyerEmail)) {
      recipients.set(order.buyerEmail, order.buyerName);
    }
  }

  const sendResults = await Promise.allSettled(
    Array.from(recipients.entries()).map(([email, buyerName]) =>
      sendEventCancelledEmailToAttendee({
        to: email,
        buyerName,
        eventTitle: event.title,
        startAt: event.startAt,
        timezone: event.timezone,
      }),
    ),
  );

  const sent = sendResults.filter((result) => result.status === "fulfilled" && result.value.sent).length;
  return { recipients: recipients.size, sent };
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}) {
  const subject = "Reset your EventsBox password";
  const text = [
    "Hello,",
    "",
    "We received a request to reset your EventsBox password.",
    `Click the link below to set a new password (valid for 30 minutes):`,
    input.resetUrl,
    "",
    "If you did not request this, ignore this email.",
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>We received a request to reset your EventsBox password.</p>
    <p><a href="${input.resetUrl}">Reset my password</a></p>
    <p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendWelcomeEmail(input: {
  to: string;
  verifyUrl: string;
}) {
  const subject = "Welcome to EventsBox — verify your email";
  const text = [
    "Welcome to EventsBox!",
    "",
    "Please verify your email address to activate your organizer account:",
    input.verifyUrl,
    "",
    "If you did not create an account, ignore this email.",
  ].join("\n");

  const html = `
    <p>Welcome to EventsBox!</p>
    <p>Please <a href="${input.verifyUrl}">verify your email address</a> to activate your organizer account.</p>
    <p>If you did not create an account, ignore this email.</p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendOrderRefundedEmail(input: {
  to: string;
  buyerName: string;
  eventTitle: string;
  orderId: string;
  total: number;
}) {
  const subject = `Refund processed: ${input.eventTitle}`;
  const text = [
    `Hi ${input.buyerName},`,
    "",
    `Your refund has been processed for event "${input.eventTitle}".`,
    `Order: ${input.orderId}`,
    `Amount: $${input.total.toFixed(2)}`,
  ].join("\n");

  const html = `
    <p>Hi ${input.buyerName},</p>
    <p>Your refund has been processed for event "<strong>${input.eventTitle}</strong>".</p>
    <p>
      Order: <strong>${input.orderId}</strong><br/>
      Amount: <strong>$${input.total.toFixed(2)}</strong>
    </p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendOrganizerCancellationRequestEmail(input: {
  to: string;
  attendeeEmail: string;
  eventTitle: string;
  orderId: string;
  reason?: string | null;
}) {
  const subject = `Cancellation request: ${input.eventTitle}`;
  const text = [
    "Hello,",
    "",
    `Attendee ${input.attendeeEmail} has requested a cancellation for order ${input.orderId}.`,
    `Event: ${input.eventTitle}`,
    ...(input.reason ? [`Reason: ${input.reason}`] : []),
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>Attendee <strong>${input.attendeeEmail}</strong> has requested a cancellation for order <strong>${input.orderId}</strong>.</p>
    <p>Event: <strong>${input.eventTitle}</strong></p>
    ${input.reason ? `<p>Reason: ${input.reason}</p>` : ""}
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendCancellationRejectedEmail(input: {
  to: string;
  buyerName: string;
  eventTitle: string;
  orderId: string;
  adminNote?: string | null;
}) {
  const subject = `Cancellation request rejected: ${input.eventTitle}`;
  const text = [
    `Hi ${input.buyerName},`,
    "",
    `Your cancellation request for order ${input.orderId} (${input.eventTitle}) has been rejected.`,
    ...(input.adminNote ? [`Organizer note: ${input.adminNote}`] : []),
  ].join("\n");

  const html = `
    <p>Hi ${input.buyerName},</p>
    <p>Your cancellation request for order <strong>${input.orderId}</strong> (${input.eventTitle}) has been rejected.</p>
    ${input.adminNote ? `<p>Organizer note: ${input.adminNote}</p>` : ""}
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendWaitlistConfirmationEmail(input: {
  to: string;
  name?: string | null;
  ticketName: string;
  eventTitle: string;
}) {
  const recipient = input.name?.trim() || "there";
  const subject = `You're on the waitlist: ${input.eventTitle}`;
  const text = [
    `Hi ${recipient},`,
    "",
    `You're on the waitlist for ${input.ticketName} at ${input.eventTitle}.`,
    "We'll notify you if tickets become available.",
  ].join("\n");

  const html = `
    <p>Hi ${recipient},</p>
    <p>You're on the waitlist for <strong>${input.ticketName}</strong> at <strong>${input.eventTitle}</strong>.</p>
    <p>We'll notify you if tickets become available.</p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}
