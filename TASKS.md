# Implementation Task List: Seating-First Workflow

This document breaks down the required tasks to implement the new seating-first organizer workflow. The tasks are categorized by domain (Database, Backend, Frontend) and should be executed in a phased approach.

## Phase 1: Foundational Backend and Database Changes

### Database (Prisma)

-   [ ] **Create a New Migration:**
    -   Apply the changes from `DATA_MODEL_PROPOSAL.md` to `prisma/schema.prisma`.
    -   Add `price` and `generatedTicketTypeId` to `EventSeatingSection`.
    -   Add `isGenerated` and the new one-to-one relation to `TicketType`.
    -   Remove the old, loose relation from `TicketType` to `EventSeatingSection`.
-   [ ] **Generate Prisma Client:**
    -   Run `npx prisma generate` after updating the schema.
-   [ ] **Run Migration:**
    -   Execute the database migration to apply the new schema: `npx prisma migrate dev --name seating-first-restructure`.

### Backend (API)

-   [ ] **Create/Update Types:**
    -   Update TypeScript types/interfaces in `src/lib/types` (or equivalent) to reflect the new Prisma models for `EventSeatingSection` and `TicketType`.
-   [ ] **Develop the Core Sync Logic Service:**
    -   Create a new service/module (e.g., `src/lib/services/seatingSync.ts`).
    -   This service will contain the transactional logic to synchronize `EventSeatingSection` and `TicketType` as described in `DATA_MODEL_PROPOSAL.md`.
    -   It should handle creation, updates, and deletion of seating zones and propagate those changes to the corresponding ticket types.
-   [ ] **Refactor Event Update API Endpoint:**
    -   Modify the main `PUT` or `POST` API endpoint for event creation/updates (likely in `app/api/organizer/events/...`).
    -   This endpoint will now accept a nested structure of seating zones with pricing.
    -   It will call the new `seatingSync` service within a database transaction (`$transaction`) to ensure data integrity.
    -   Remove any logic that handles the old manual ticket creation or mapping.

## Phase 2: Frontend Workflow Implementation

### Frontend (Next.js/React)

-   [ ] **Restructure Organizer Workflow State:**
    -   Update the state management (e.g., Zustand, Redux, React Context) that controls the event creation wizard.
    -   Change the steps from `[Details, Tickets, Layout, Map, Review]` to `[Details, Seating, Review]`.
-   [ ] **Remove Old UI Components:**
    -   Delete the React components for the old "Ticket Classes" manual creation form.
    -   Delete the components for the old "Mapping" step.
-   [ ] **Create the "Seating Map & Pricing" Component:**
    -   This is the largest frontend task. Build a new, unified UI component for the second step.
    -   It needs to support:
        -   Adding/removing zones (`EventSeatingSection`).
        -   Editing the `name`, `sectionType` (GA, Seated, Table), `capacity`, and `price` for each zone.
        -   A visual representation of the zones (even if abstract).
        -   Form validation (e.g., name and price are required, capacity > 0).
-   [ ] **Update the "Review" Step Component:**
    -   Modify the review component to display the event details and a summary of the *generated* ticket types based on the seating plan.
    -   The data should be fetched from the seating plan, not from a separate list of manually created tickets.
-   [ ] **Update Event Details Step (If Needed):**
    -   Ensure the Event Details step correctly saves its data and transitions to the new "Seating Map & Pricing" step.

## Phase 3: Validation and Testing

### Validation

-   [ ] **Backend Validation (API Endpoint):**
    -   Add robust Zod (or other) validation for the incoming seating plan payload.
    -   Ensure every zone has a valid price and capacity.
    -   Prevent deletion of zones if tickets have already been sold (or handle it gracefully).
-   [ ] **Frontend Validation (UI):**
    -   Implement real-time form validation in the Seating Map component to guide the user.
    -   Disable the "Continue" button if the seating configuration is invalid.

### Testing

-   [ ] **Backend Unit/Integration Tests:**
    -   Write tests for the `seatingSync` service to cover all scenarios (create, update, delete, edge cases).
-   [ ] **Frontend Component Tests:**
    -   Write tests for the new "Seating Map & Pricing" component to ensure its state is managed correctly.
-   [ ] **End-to-End (E2E) Tests:**
    -   Create a new Playwright/Cypress test for the entire restructured organizer workflow.
    -   Verify that an event can be created, tickets are generated correctly, and they appear for sale.
    -   Test that simple (GA-only) and mixed-seating events can be created successfully.

## Phase 4: Backward Compatibility & Data Migration

-   [ ] **Analyze Existing Data:**
    -   Write a script to analyze existing events and determine how many use the old manual ticket/mapping system.
-   [ ] **Develop a Migration Strategy:**
    -   For events with existing ticket sales, they may need to be locked into the old system or carefully migrated.
    -   For draft events, create a script that attempts to convert manually created tickets and mappings into the new `SeatingZone`-based structure.
    -   The `isGenerated: false` flag will be crucial for identifying which tickets to process.
