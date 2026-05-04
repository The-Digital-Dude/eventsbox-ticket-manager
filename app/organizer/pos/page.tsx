import { redirect } from "next/navigation";
import { OrganizerApprovalStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PosTerminal, type PosEvent } from "@/app/organizer/pos/pos-terminal";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/affiliate", label: "Affiliate Links" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

export default async function OrganizerPosPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    redirect("/auth/login");
  }

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      approvalStatus: true,
      events: {
        where: { status: "PUBLISHED" },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          title: true,
          mode: true,
          startAt: true,
          venue: { select: { name: true } },
          ticketTypes: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              sectionId: true,
              name: true,
              price: true,
              quantity: true,
              sold: true,
              reservedQty: true,
            },
          },
          seatingSections: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              name: true,
              color: true,
              rows: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  label: true,
                  seats: {
                    orderBy: { seatLabel: "asc" },
                    select: {
                      id: true,
                      sectionId: true,
                      seatLabel: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!profile || profile.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    redirect("/organizer/status");
  }

  const events: PosEvent[] = profile.events.map((event) => {
    const ticketBySectionId = new Map(
      event.ticketTypes
        .filter((ticket) => ticket.sectionId)
        .map((ticket) => [ticket.sectionId!, ticket]),
    );

    return {
      id: event.id,
      title: event.title,
      mode: event.mode,
      startAt: event.startAt.toISOString(),
      venueName: event.venue?.name ?? null,
      ticketTypes: event.ticketTypes.map((ticket) => ({
        id: ticket.id,
        sectionId: ticket.sectionId,
        name: ticket.name,
        price: Number(ticket.price),
        quantity: ticket.quantity,
        sold: ticket.sold,
        reservedQty: ticket.reservedQty,
      })),
      sections: event.seatingSections.map((section) => ({
        id: section.id,
        name: section.name,
        color: section.color,
        rows: section.rows.map((row) => ({
          id: row.id,
          label: row.label,
          seats: row.seats.map((seat) => {
            const ticket = ticketBySectionId.get(seat.sectionId) ?? null;
            return {
              id: seat.id,
              sectionId: seat.sectionId,
              seatLabel: seat.seatLabel,
              status: ticket ? seat.status : "BLOCKED",
              ticketTypeId: ticket?.id ?? null,
              ticketTypeName: ticket?.name ?? null,
              price: ticket ? Number(ticket.price) : 0,
            };
          }),
        })),
      })),
    };
  });

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PosTerminal events={events} />
    </SidebarLayout>
  );
}
