import { Prisma } from '@prisma/client';
import { db } from '../db';
import { RelationalSeatingLayout } from '@/types/event-draft';

type SeatingZoneData = RelationalSeatingLayout['sections'][0];

/**
 * Synchronizes the seating plan and pricing with the generated ticket types for an event.
 * This should be executed within a Prisma transaction.
 * @param eventId The ID of the event to sync.
 * @param seatingLayout The new seating layout data from the event draft.
 * @param tx The Prisma transaction client.
 */
export async function syncSeatingPlanAndTickets(
  eventId: string,
  seatingLayout: RelationalSeatingLayout,
  tx: Prisma.TransactionClient
) {
  const existingSections = await tx.eventSeatingSection.findMany({
    where: { eventSeatingPlan: { eventId } },
    include: { generatedTicketType: true },
  });

  const newZones = seatingLayout.sections;
  const newZoneKeys = new Set(newZones.map((z) => z.key));

  // --- Step 1: Create or Update Zones and Tickets ---
  for (const zoneData of newZones) {
    const existingSection = existingSections.find((s) => s.key === zoneData.key);

    if (existingSection) {
      // Update existing section
      const updatedSection = await tx.eventSeatingSection.update({
        where: { id: existingSection.id },
        data: {
          name: zoneData.name,
          sectionType: zoneData.sectionType,
          capacity: zoneData.capacity,
          price: zoneData.price,
          sortOrder: zoneData.sortOrder,
        },
      });

      // If a ticket is linked, update it
      if (existingSection.generatedTicketType) {
        await tx.ticketType.update({
          where: { id: existingSection.generatedTicketType.id },
          data: {
            name: updatedSection.name,
            price: updatedSection.price,
            quantity: updatedSection.capacity,
          },
        });
      }
    } else {
      // Create new section and corresponding ticket
      const newTicket = await tx.ticketType.create({
        data: {
          event: { connect: { id: eventId } },
          name: zoneData.name,
          price: zoneData.price,
          quantity: zoneData.capacity,
          isGenerated: true,
          classType: 'GENERAL_ADMISSION', // Or derive from sectionType
        },
      });

      await tx.eventSeatingSection.create({
        data: {
          eventSeatingPlan: { connect: { id: seatingLayout.id } },
          key: zoneData.key,
          name: zoneData.name,
          sectionType: zoneData.sectionType,
          capacity: zoneData.capacity,
          price: zoneData.price,
          sortOrder: zoneData.sortOrder,
          generatedTicketType: { connect: { id: newTicket.id } },
        },
      });
    }
  }

  // --- Step 2: Delete Old Zones and Tickets ---
  const zonesToDelete = existingSections.filter((s) => !newZoneKeys.has(s.key));

  for (const section of zonesToDelete) {
    // Deleting the section will cascade and set the ticket link to null
    await tx.eventSeatingSection.delete({ where: { id: section.id } });

    // The ticket itself is not deleted to preserve order history,
    // but we can deactivate it.
    if (section.generatedTicketTypeId) {
      await tx.ticketType.update({
        where: { id: section.generatedTicketTypeId },
        data: { isActive: false },
      });
    }
  }
}
