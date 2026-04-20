# Organizer Workflow Analysis

This document outlines the current workflow for an organizer on the event ticketing platform.

## 1. Onboarding

The organizer's journey begins with creating an account and an Organizer Profile. The dashboard prominently displays onboarding health, encouraging completion of profile details. An approved Organizer Profile seems to be a prerequisite for creating events and venues.

## 2. Event Creation

The primary workflow appears to be **event-first**.

1.  From the Organizer Dashboard, the main call to action is **"+ New Event"**.
2.  This leads to a comprehensive form where the organizer provides all event details, including title, description, schedule, and category.
3.  Crucially, the organizer can **select an existing, pre-approved venue** from a dropdown list. There is no option to create a venue within the event creation flow. This implies that venues must be created and approved beforehand.
4.  Upon successful event creation, the organizer is redirected to the event's detail page.

## 3. Ticket Creation

Tickets are created after an event has been established.

1.  On the event detail page (`/organizer/events/[id]`), there is a "Ticket Classes" section.
2.  The organizer can add new ticket classes by filling out a form that includes name, price, quantity, and `classType` (General, Seating, Table, Mixed).
3.  If the event requires a layout (i.e., has non-general admission ticket classes), the organizer is prompted to "Continue Layout Setup".

## 4. Venue and Seating Map Creation

The venue and seating map creation is a separate, distinct workflow, accessible from the "Venues" tab in the organizer's sidebar. This is a **venue-first** process.

1.  The venue creation page is a two-step process:
    *   **Step 1: Details:** The organizer enters the venue's name, address, and other metadata.
    *   **Step 2: Seating:** The organizer uses the `LayoutBuilderShell` to create a seating map for the venue. This includes defining sections, rows, seats, and tables.
2.  A venue and its seating map are created and submitted together for admin approval.
3.  The seating map is stored as a JSON object (`seatingConfig` and `seatState`) on the `Venue` model.

## 5. Connecting the Pieces: The Event Layout

The "Event Layout" is where the event, venue, and seating map converge. This is a source of potential confusion.

1.  When an event requires a layout, the organizer is directed to the "Event Layout" page (`/organizer/events/[id]/layout`).
2.  Here, the organizer does not create a new seating map from scratch. Instead, they are expected to work with the seating map associated with the event's selected venue.
3.  The `Event` model has a `venueId` to link to a `Venue`. It also has a `seatingPlan`, which is of type `EventSeatingPlan`.
4.  The `EventSeatingPlan` seems to be a copy or an adaptation of the `Venue`'s `seatingConfig`. The `EventSeatingPlan` has a `source` field, which can be `VENUE_TEMPLATE`, `COPIED_EVENT`, or `CUSTOM`.
5.  This indicates that an event has its own seating plan, which can be sourced from a venue's template but is then owned by the event.

## Summary of Flow

The current flow is mixed, but with a clear separation of concerns:

-   **Event-First:** Organizers start by creating an event and attaching an *existing, approved* venue.
-   **Venue-First:** Venues and their seating maps must be created and approved as a separate, prior step.
-   **Post-Creation Configuration:** After an event is created, tickets are added, and if necessary, the event-specific seating layout is configured.

This separation can lead to context switching and potential dead ends in the user journey, which are further detailed in the `CURRENT_GAPS.md` document.
