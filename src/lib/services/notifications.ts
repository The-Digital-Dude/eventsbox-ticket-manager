import { Resend } from "resend";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { generateQrDataUrl } from "@/src/lib/qr";

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

type EmailSendResult =
  | { sent: true; skipped: false }
  | { sent: false; skipped: true; reason: "MISSING_CONFIG" }
  | { sent: false; skipped: false; reason: "PROVIDER_ERROR" };

async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const client = getResendClient();
  if (!client || !env.EMAIL_FROM) {
    console.warn("[email] skipped due to missing configuration", {
      hasResendApiKey: Boolean(env.RESEND_API_KEY),
      hasEmailFrom: Boolean(env.EMAIL_FROM),
    });
    return { sent: false, skipped: true as const, reason: "MISSING_CONFIG" as const };
  }

  try {
    const result = await client.emails.send({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
    });
    if (result.error) {
      console.error("Email send failed:", result.error);
      return { sent: false, skipped: false as const, reason: "PROVIDER_ERROR" as const };
    }
    return { sent: true, skipped: false as const };
  } catch (error) {
    console.error("Email send failed:", error);
    return { sent: false, skipped: false as const, reason: "PROVIDER_ERROR" as const };
  }
}

export async function sendOrderConfirmationEmail(input: {
  to: string;
  buyerName: string;
  orderId: string;
  eventTitle: string;
  startAt: Date;
  timezone: string;
  venueName: string | null;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    ticketTypeName: string;
  }>;
  orderUrl: string;
}) {
  const formattedStartAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: input.timezone,
  }).format(new Date(input.startAt));
  const ticketsWithQr = await Promise.all(
    input.tickets.map(async (ticket) => ({
      ...ticket,
      qrDataUrl: await generateQrDataUrl(ticket.id),
    })),
  );
  const subject = `Order confirmed: ${input.eventTitle}`;
  const text = [
    `Hi ${input.buyerName},`,
    "",
    `Your order (${input.orderId}) is confirmed for ${input.eventTitle}.`,
    `Date: ${formattedStartAt} (${input.timezone})`,
    `Venue: ${input.venueName ?? "Venue TBA"}`,
    "",
    "Tickets:",
    ...ticketsWithQr.map(
      (ticket) => `- ${ticket.ticketTypeName} · ${ticket.ticketNumber} · QR value: ${ticket.id}`,
    ),
    "",
    `View your tickets: ${input.orderUrl}`,
    "",
    "Thanks for booking with EventsBox.",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827">
      <p>Hi ${input.buyerName},</p>
      <p>
        Your order (<strong>${input.orderId}</strong>) is confirmed for
        <strong>${input.eventTitle}</strong>.
      </p>
      <p>
        Date: ${formattedStartAt} (${input.timezone})<br/>
        Venue: ${input.venueName ?? "Venue TBA"}
      </p>
      <div style="margin-top:24px">
        ${ticketsWithQr
          .map(
            (ticket) => `
              <div style="margin-bottom:20px;padding:16px;border:1px solid #e5e7eb;border-radius:16px">
                <p style="margin:0 0 8px;font-weight:600">${ticket.ticketTypeName}</p>
                <p style="margin:0 0 12px;font-size:13px;color:#6b7280">${ticket.ticketNumber}</p>
                <img
                  src="${ticket.qrDataUrl}"
                  alt="QR code for ${ticket.ticketNumber}"
                  width="180"
                  height="180"
                  style="display:block;border:1px solid #e5e7eb;border-radius:12px"
                />
              </div>
            `,
          )
          .join("")}
      </div>
      <p><a href="${input.orderUrl}">View your tickets</a></p>
      <p>Thanks for booking with EventsBox.</p>
    </div>
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
  otp: string;
}) {
  const subject = "Welcome to EventsBox — your verification code";
  const text = [
    "Welcome to EventsBox!",
    "",
    `Your verification code is: ${input.otp}`,
    "",
    "This code expires in 10 minutes.",
    "If you did not create an account, ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <p style="font-size:14px;color:#6b7280;margin-bottom:8px">Welcome to EventsBox</p>
      <p style="font-size:16px;color:#111827;margin-bottom:24px">Enter this code to verify your email address:</p>
      <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1e1b4b;font-family:monospace">${input.otp}</span>
      </div>
      <p style="font-size:13px;color:#6b7280">This code expires in <strong>10 minutes</strong>.</p>
      <p style="font-size:13px;color:#6b7280">If you did not create an account, ignore this email.</p>
    </div>
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

export async function sendWaitlistAvailabilityEmail(input: {
  to: string;
  name?: string | null;
  ticketName: string;
  eventTitle: string;
  eventUrl: string;
}) {
  const recipient = input.name?.trim() || "there";
  const subject = `Ticket available: ${input.eventTitle}`;
  const text = [
    `Hi ${recipient},`,
    "",
    `Good news! A ${input.ticketName} ticket for ${input.eventTitle} is now available.`,
    `Purchase here: ${input.eventUrl}`,
  ].join("\n");

  const html = `
    <p>Hi ${recipient},</p>
    <p>Good news! A <strong>${input.ticketName}</strong> ticket for <strong>${input.eventTitle}</strong> is now available.</p>
    <p><a href="${input.eventUrl}">Purchase tickets</a></p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendComplimentaryTicketEmail(input: {
  to: string;
  recipientName: string;
  eventTitle: string;
  ticketTypeName: string;
  ticketNumber: string;
  startAt: Date;
  timezone: string;
  venueName: string | null;
  orderUrl: string;
}) {
  const formattedStartAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: input.timezone,
  }).format(new Date(input.startAt));
  const subject = `You've received a complimentary ticket for ${input.eventTitle}`;
  const text = [
    `Hi ${input.recipientName},`,
    "",
    `You've received a complimentary ${input.ticketTypeName} ticket for ${input.eventTitle}.`,
    `Ticket number: ${input.ticketNumber}`,
    `Date: ${formattedStartAt} (${input.timezone})`,
    `Venue: ${input.venueName ?? "Venue TBA"}`,
    "",
    `View your ticket: ${input.orderUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827">
      <p>Hi ${input.recipientName},</p>
      <p>
        You've received a complimentary <strong>${input.ticketTypeName}</strong> ticket for
        <strong>${input.eventTitle}</strong>.
      </p>
      <p>
        Ticket number: <strong>${input.ticketNumber}</strong><br/>
        Date: ${formattedStartAt} (${input.timezone})<br/>
        Venue: ${input.venueName ?? "Venue TBA"}
      </p>
      <p><a href="${input.orderUrl}">View your ticket</a></p>
    </div>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendTicketTransferInviteEmail(input: {
  to: string;
  toName: string;
  fromEmail: string;
  eventTitle: string;
  ticketNumber: string;
  acceptUrl: string;
  expiresAt: Date;
}) {
  const subject = `Ticket transfer invitation: ${input.eventTitle}`;
  const text = [
    `Hi ${input.toName},`,
    "",
    `${input.fromEmail} wants to transfer ticket ${input.ticketNumber} for ${input.eventTitle} to you.`,
    `Accept here: ${input.acceptUrl}`,
    `This link expires on ${input.expiresAt.toLocaleString()}.`,
  ].join("\n");

  const html = `
    <p>Hi ${input.toName},</p>
    <p>
      <strong>${input.fromEmail}</strong> wants to transfer ticket
      <strong>${input.ticketNumber}</strong> for <strong>${input.eventTitle}</strong> to you.
    </p>
    <p><a href="${input.acceptUrl}">Accept ticket transfer</a></p>
    <p>This link expires on ${input.expiresAt.toLocaleString()}.</p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendTicketTransferSenderEmail(input: {
  to: string;
  recipientName: string;
  recipientEmail: string;
  eventTitle: string;
  ticketNumber: string;
  expiresAt: Date;
}) {
  const subject = `Transfer requested: ${input.eventTitle}`;
  const text = [
    "Hello,",
    "",
    `Your transfer request for ticket ${input.ticketNumber} has been sent to ${input.recipientName} (${input.recipientEmail}).`,
    `Event: ${input.eventTitle}`,
    `The link expires on ${input.expiresAt.toLocaleString()}.`,
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>
      Your transfer request for ticket <strong>${input.ticketNumber}</strong> has been sent to
      <strong>${input.recipientName}</strong> (${input.recipientEmail}).
    </p>
    <p>Event: <strong>${input.eventTitle}</strong></p>
    <p>The link expires on ${input.expiresAt.toLocaleString()}.</p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendTicketTransferAcceptedRecipientEmail(input: {
  to: string;
  toName: string;
  eventTitle: string;
  ticketNumber: string;
  orderUrl: string;
}) {
  const subject = `Ticket transfer accepted: ${input.eventTitle}`;
  const text = [
    `Hi ${input.toName},`,
    "",
    `Ticket ${input.ticketNumber} for ${input.eventTitle} is now yours.`,
    `View the ticket here: ${input.orderUrl}`,
  ].join("\n");

  const html = `
    <p>Hi ${input.toName},</p>
    <p>
      Ticket <strong>${input.ticketNumber}</strong> for <strong>${input.eventTitle}</strong> is now yours.
    </p>
    <p><a href="${input.orderUrl}">View your ticket</a></p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendTicketTransferAcceptedSenderEmail(input: {
  to: string;
  recipientName: string;
  recipientEmail: string;
  eventTitle: string;
  ticketNumber: string;
}) {
  const subject = `Ticket transferred: ${input.eventTitle}`;
  const text = [
    "Hello,",
    "",
    `Your transfer of ticket ${input.ticketNumber} for ${input.eventTitle} was accepted by ${input.recipientName} (${input.recipientEmail}).`,
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>
      Your transfer of ticket <strong>${input.ticketNumber}</strong> for
      <strong>${input.eventTitle}</strong> was accepted by
      <strong>${input.recipientName}</strong> (${input.recipientEmail}).
    </p>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}
