import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { fail, ok } from "@/src/lib/http/response";
import { rateLimitRedis } from "@/src/lib/http/rate-limit-redis";
import { sendWaitlistConfirmationEmail } from "@/src/lib/services/notifications";

const waitlistJoinSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(200).optional(),
  ticketTypeId: z.string().cuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = await rateLimitRedis(`waitlist:${ip}`, 5, 60_000);
    if (rl.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many waitlist attempts. Try again in a minute." });
    }

    const parsed = waitlistJoinSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid waitlist request payload",
        details: parsed.error.flatten(),
      });
    }

    const { slug } = await params;
    const event = await prisma.event.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        ticketTypes: {
          where: { id: parsed.data.ticketTypeId },
          select: {
            id: true,
            name: true,
            quantity: true,
            sold: true,
          },
        },
      },
    });

    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const ticketType = event.ticketTypes[0];
    if (!ticketType) {
      return fail(404, { code: "TICKET_NOT_FOUND", message: "Ticket type not found for event" });
    }

    if (ticketType.sold < ticketType.quantity) {
      return fail(400, { code: "TICKETS_AVAILABLE", message: "Tickets are still available" });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await prisma.waitlist.findUnique({
      where: {
        ticketTypeId_email: {
          ticketTypeId: ticketType.id,
          email,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return ok({ alreadyJoined: true });
    }

    const session = await getServerSession();
    const attendeeProfile =
      session?.user.role === "ATTENDEE"
        ? await prisma.attendeeProfile.findUnique({
            where: { userId: session.user.id },
            select: { id: true },
          })
        : null;

    const entry = await prisma.waitlist.create({
      data: {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        attendeeProfileId: attendeeProfile?.id ?? null,
        email,
        name: parsed.data.name?.trim() || null,
      },
      select: { id: true },
    });

    void sendWaitlistConfirmationEmail({
      to: email,
      name: parsed.data.name,
      ticketName: ticketType.name,
      eventTitle: event.title,
    }).catch((error) => {
      console.error("[app/api/events/[slug]/waitlist/route.ts][notify]", error);
    });

    return ok({ joined: true, id: entry.id });
  } catch (error) {
    console.error("[app/api/events/[slug]/waitlist/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to join waitlist" });
  }
}
