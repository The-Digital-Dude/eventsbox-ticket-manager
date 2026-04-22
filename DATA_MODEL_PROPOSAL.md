# Data Model Restructure Proposal

This document proposes changes to the Prisma data model to support the new seating-first event creation workflow. The guiding principle is to make the event's seating and pricing structure the single source of truth, with ticket types being an automatically generated consequence of that structure.

## 1. Core Concept: Seating Zone as the Source of Truth

The most significant change is elevating the `EventSeatingSection` (which we will conceptually rename to `SeatingZone` for clarity) to be the primary driver of inventory and pricing. Each `SeatingZone` will directly define a sellable area of the event.

## 2. Proposed Model Changes

Below are the proposed modifications to the `prisma.schema`.

### `Event` Model

No major changes are required for the `Event` model itself. Its relationship to `EventSeatingPlan` remains key.

### `EventSeatingPlan` Model

No changes are needed here. It will continue to act as the container for the collection of `SeatingZone`s for an event.

### `EventSeatingSection` -> `SeatingZone`

We will conceptually treat `EventSeatingSection` as a `SeatingZone`. The model will be modified to include pricing and become the definitive source for generating a ticket.

```prisma
// In prisma.schema

model EventSeatingSection {
  id                 String                  @id @default(cuid())
  eventSeatingPlanId String
  key                String                  // Used as a stable identifier for frontend
  name               String                  // Display name, e.g., "VIP Balcony"
  sectionType        EventSeatingSectionType // ROWS, TABLES, SECTIONED_GA
  capacity           Int
  sortOrder          Int                     @default(0)

  // --- NEW FIELDS ---
  price              Decimal                 @db.Decimal(10, 2) // Price for this zone
  // The generated ticket type will be linked here
  generatedTicketTypeId String?                @unique

  // --- RELATIONS ---
  eventSeatingPlan      EventSeatingPlan      @relation(fields: [eventSeatingPlanId], references: [id], onDelete: Cascade)

  // This relation replaces the old one on TicketType
  generatedTicketType   TicketType?           @relation("GeneratedTicket", fields: [generatedTicketTypeId], references: [id], onDelete: SetNull)

  @@unique([eventSeatingPlanId, key])
  @@index([eventSeatingPlanId])
}
```

**Key Changes:**

1.  **`price`**: A `Decimal` field is added directly to the section. This is the price for a single seat/spot in that zone.
2.  **`generatedTicketTypeId` & `generatedTicketType`**: A new one-to-one relationship is established. Each seating zone will point to the single `TicketType` it generates. This creates a direct, unambiguous link.
3.  **`capacity`**: This field becomes non-optional (`Int`) as it's crucial for inventory management.

### `TicketType` Model

The `TicketType` model will be repurposed. Instead of being a manually created entity, it becomes a derivative of a `SeatingZone`. It stores information needed for the checkout/order process but is not the source of truth for pricing or capacity.

```prisma
// In prisma.schema

model TicketType {
  id                    String      @id @default(cuid())
  eventId               String
  name                  String      // Name will be copied from the SeatingZone
  price                 Decimal     @db.Decimal(10, 2) // Price will be copied from the SeatingZone
  quantity              Int         // Quantity will be copied from the SeatingZone capacity

  // --- NEW / MODIFIED FIELDS ---
  isGenerated           Boolean     @default(true) // Flag to distinguish auto-generated tickets
  sourceSeatingSectionId String?     @unique // Foreign key for the reverse 1:1 relation

  // --- RELATIONS ---
  event                 Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  // The SeatingZone that generated this ticket
  sourceSeatingSection  EventSeatingSection? @relation("GeneratedTicket")

  // --- UNCHANGED RELATIONS & FIELDS ---
  sold                  Int         @default(0)
  reservedQty           Int         @default(0)
  // ... other fields like orderItems, saleStartAt, etc., remain
}
```

**Key Changes:**

1.  **`isGenerated`**: A boolean flag to clearly identify tickets created by the new system versus any legacy, manually created tickets. This helps with backward compatibility and migration.
2.  **`sourceSeatingSection` relation**: The other side of the one-to-one relationship, linking the ticket back to its source `EventSeatingSection`.
3.  **Removed fields**: The previous, looser `eventSeatingSectionId` foreign key is removed in favor of the new, stricter one-to-one relation.

## 3. Data Synchronization Logic

The backend service responsible for creating/updating an event will now perform the following transactional logic:

1.  When an organizer saves the "Seating Map & Pricing" step, the service receives an array of `SeatingZone` data (name, type, capacity, price).
2.  For each `SeatingZone` in the payload:
    -   **If it's a new zone**: Create a new `EventSeatingSection` record. Then, immediately create a new `TicketType` record, copying the `name`, `price`, and `capacity` (`quantity`). Link the two records together.
    -   **If it's an existing zone**: Update the `EventSeatingSection` record. Then, find the linked `TicketType` and update its `name`, `price`, and `quantity` to match.
    -   **If a zone was removed**: Delete the `EventSeatingSection`. The `onDelete: SetNull` rule on the relation will ensure the linked `TicketType` is not deleted but its link is severed. A cleanup job could then archive or handle these orphaned (but potentially sold) tickets.

This ensures that the `TicketType` entities sold to customers always reflect the structure defined by the organizer in the seating map.
