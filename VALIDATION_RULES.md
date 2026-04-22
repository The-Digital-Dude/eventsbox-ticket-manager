
# Event Creation Workflow Validation Rules

This document outlines the full validation rules for the organizer event creation workflow.

## Event Details (Step 1)

-   `title`:
    -   Required
    -   Minimum 3 characters
    -   Maximum 200 characters
-   `description`:
    -   Optional
    -   Maximum 5000 characters
-   `startAt`, `endAt`:
    -   Required
    -   Must be a valid ISO 8601 datetime string
    -   `endAt` must be after `startAt`
    -   `startAt` must not be in the past
-   Venue/location requirement:
    -   Satisfied by a legacy `venueId`, if present
    -   Satisfied for physical events by inline `location.venueName`, `location.address`, `location.city`, and `location.country`
    -   Satisfied for online events by inline `location.accessLink`
    -   Do not require a separate venue assignment when inline event location details are complete

## Ticket Classes (Step 2)

-   At least one ticket class is required.
-   Each ticket class must have:
    -   `name`:
        -   Required
        -   Unique within the event
    -   `price`:
        -   Required
        -   Must be a non-negative number
    -   `quantity`:
        -   Required
        -   Must be a positive integer
    -   `classType`:
        -   Required

## Layout Setup (Step 3)

-   This step is only required if any ticket class has a `classType` of `ASSIGNED_SEAT` or `TABLE`.
-   The layout type must match the ticket class requirements.
-   Required sections/tables must exist before assignment.

## Ticket Assignment (Step 4)

-   This step is only required if any ticket class has a `classType` of `ASSIGNED_SEAT` or `TABLE`.
-   Each required ticket class must be assigned to a compatible target.
-   `TABLE` classes can only be assigned to table-compatible targets.
-   `ASSIGNED_SEAT` classes can only be assigned to seat/section-compatible targets.

## Capacity Rules (Cross-Step)

-   The quantity of a ticket class must not exceed the capacity of its assigned section.

## Submit for Approval (Step 5)

-   All the above validation rules must pass.
-   The final payload sent to the backend must match the organizer-first event payload: inline `details.location`, ticket classes, optional event-owned layout, and optional legacy `venueId`.

## Backend API

-   The `POST /api/organizer/events` endpoint must validate the organizer-first payload and must not require `venueId` when inline physical or online location details are complete.
-   The backend must return specific and useful error messages if validation fails.
