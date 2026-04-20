# Current Domain Model

This document describes the core domain models of the platform, based on the Prisma schema.

## Core Entities

-   **OrganizerProfile**: Represents the organizer. It holds company information, approval status, and has relationships with `Event`, `Venue`, and other organizer-specific models.

-   **Venue**: Represents a physical location for events. A `Venue` belongs to an `OrganizerProfile`.
    -   It has a `status` (e.g., `PENDING_APPROVAL`, `APPROVED`), indicating that venues are subject to admin review.
    -   It stores a seating configuration directly on the model as JSON (`seatingConfig`, `seatState`). This suggests a venue has a default or template seating map.

-   **Event**: The central entity of the platform. An `Event` belongs to an `OrganizerProfile`.
    -   It can be associated with a `Venue` (optional `venueId`).
    -   It has a `status` (e.g., `DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`).
    -   It has its own `seatingPlan` through a one-to-one relationship with `EventSeatingPlan`.

-   **EventSeatingPlan**: This model represents the specific seating layout for an *event*. This is a critical distinction.
    -   It is linked to an `Event`.
    -   It has a `source` field (`EventSeatingSource`), indicating whether the plan was copied from a venue template, another event, or is a custom one-off.
    -   It stores its own `seatingConfig`, `seatState`, and `summary` as JSON. This means an event's seating plan is a *copy* of a venue's seating plan, not a direct link.
    -   It has a one-to-many relationship with `EventSeatingSection`.

-   **EventSeatingSection**: Represents a section within an `EventSeatingPlan` (e.g., "VIP", "General Admission").
    -   It has a `sectionType` (`ROWS`, `TABLES`, `SECTIONED_GA`).
    -   It holds the `capacity` for that section.

-   **TicketType**: Represents a class of tickets for an event (e.g., "Adult", "Child").
    -   It belongs to an `Event`.
    -   It has an `inventoryMode` (`GENERAL_ADMISSION`, `ASSIGNED_SEAT`, `TABLE`, `SECTIONED_GA`) which determines if it needs a seating layout.
    -   It can be linked to an `EventSeatingSection` (`eventSeatingSectionId`), mapping the ticket type to a specific section of the event's layout.

## Relationships and Data Flow

-   An `OrganizerProfile` can have many `Venue`s and many `Event`s.
-   A `Venue` has one default seating configuration stored as JSON.
-   An `Event` can have one `Venue`.
-   An `Event` has one `EventSeatingPlan`. This plan is independent of the `Venue`'s seating configuration after it has been created.
-   An `EventSeatingPlan` is composed of `EventSeatingSection`s.
-   A `TicketType` is associated with an `Event` and can be optionally mapped to an `EventSeatingSection`.

This domain model is normalized and provides a good separation of concerns, but it also introduces complexity in the user flow. The decoupling of an event's seating plan from its venue's seating plan means that an organizer has to manage two different (but potentially identical) seating configurations.
