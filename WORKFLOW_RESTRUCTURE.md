# Organizer Workflow Restructure Analysis

This document outlines the plan to refactor the event creation workflow from a "ticket-first" to a "seating-first" architecture, as per new client requirements.

## 1. Old Flow vs. New Flow

### Old Flow (Ticket-First)

The previous workflow forced organizers to think about sellable tickets before defining the physical or virtual layout of their event.

1.  **Event Details**: Basic event information (name, date, venue).
2.  **Ticket Classes**: Manually create each ticket type (e.g., "General Admission," "VIP," "Early Bird"). The organizer defines the name, price, and quantity here. This step is the source of truth for what is sold.
3.  **Layout Setup**: Optionally create a seating layout (GA, seated sections, tables). This was disconnected from ticket classes.
4.  **Mapping**: Manually associate the previously created ticket classes to the sections in the layout. This step was a major source of friction and errors.
5.  **Review**: A final overview of the event setup.

### New Flow (Seating-First)

The new workflow makes the event's physical structure the source of truth, from which sellable tickets are automatically derived.

1.  **Event Details**: (Largely unchanged) Basic event information.
2.  **Seating Map & Pricing**: A unified step where the organizer builds the event space. They can:
    -   Define sections (e.g., "Orchestra," "Balcony").
    -   Set the type for each section (Seated, Tables, General Admission).
    -   Assign a **price** and **capacity** directly to each section/zone.
    -   This step becomes the primary source of truth for inventory and pricing.
3.  **Auto Ticket Generation**: (Implicit/Automated) Based on the Seating Map, the system will automatically generate the corresponding `TicketType` records.
    -   A "Balcony" section priced at $50 creates a "Balcony" ticket type.
    -   This removes the need for manual creation and mapping.
4.  **Review / Submit**: A streamlined review step showing the event details and the generated ticket types with their prices and capacities.

## 2. Architectural Impact

The core change is shifting the **source of truth** from the `TicketType` model to the `EventSeatingPlan` and its associated `EventSeatingSection` models.

-   **Current State**: `TicketType` is created manually, and then optionally mapped to a `EventSeatingSection`.
-   **Proposed State**: `EventSeatingSection` (or a similar entity) will store the price, capacity, and name. The `TicketType` will be a derivative, auto-generated entity that is kept in sync with the seating plan.

This is a significant architectural shift that will touch the data model, backend services, and frontend UI.

## 3. What to Remove, Reuse, and Refactor

### To Remove:

-   **Separate "Ticket Classes" Step UI**: The manual creation form for `TicketType` in the organizer workflow will be removed.
-   **Separate "Layout Setup" Step UI**: This is merged into the new "Seating Map & Pricing" step.
-   **Separate "Mapping" Step UI**: The manual mapping UI is now redundant, as the link between a seating area and a ticket is direct and automatic.
-   **Backend Logic for Manual Mapping**: The API endpoints and services responsible for linking tickets to sections will be deprecated.

### To Reuse:

-   **`Event` Model**: The core event data model remains valid.
-   **`TicketType` Model**: This model is still essential for the checkout and order management process. It will be repurposed to store the *generated* ticket data. We will likely add a field to indicate it is auto-generated and link it directly to its source seating zone.
-   **`EventSeatingPlan` Model**: This can be reused as the container for the new seating structure.
-   **Event Details UI**: This step in the workflow requires minimal changes.
-   **Existing Checkout Flow**: The customer-facing purchase flow should still function correctly as it relies on `TicketType`, which will continue to be populated.

### To Refactor:

-   **`EventSeatingSection` Model**: This model (or a new one) must be augmented to store **pricing information** and potentially more detailed capacity rules. This is the centerpiece of the new structure.
-   **Organizer Workflow State Management**: The frontend state machine/router for the event creation wizard must be updated to reflect the new steps.
-   **Backend Event Creation/Update Service**: The core logic for saving an event will need a major overhaul. It must now:
    1.  Receive seating plan data with pricing.
    2.  Create/update the `EventSeatingSection` records.
    3.  Automatically create/update/delete the corresponding `TicketType` records.
    4.  Implement robust validation to ensure data integrity (e.g., no orphaned tickets, all priced zones have a ticket).
-   **`prisma.schema`**: The database schema will need to be migrated to support the new relationships and fields.
