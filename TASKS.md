# Implementation Plan: Step-Based Organizer Workflow

This document outlines the engineering tasks required to implement the redesigned, step-based organizer workflow.

## Database

-   **[COMPLETED]** **Task 1:** In the `TicketType` model, rename the `inventoryMode` field to `classType`.
-   **[COMPLETED]** **Task 2:** Update the `classType` enum to include `GENERAL_ADMISSION`, `ASSIGNED_SEAT`, `TABLE`, and `MIXED`.
-   **[PENDING]** **Task 3:** Create a migration script to safely migrate the existing `inventoryMode` data to the new `classType` field. (Blocked by local DB permissions).
-   **[COMPLETED]** **Task 4:** Add a `draftEvent` JSONB field to the `OrganizerProfile` model to store the state of the event creation form, allowing organizers to resume their work.

## Backend

-   **[COMPLETED]** **Task 1:** Create a new API endpoint `POST /api/organizer/events/draft` to save the state of the event creation form to the `draftEvent` field on the `OrganizerProfile`.
-   **[COMPLETED]** **Task 2:** Create an API endpoint `GET /api/organizer/events/draft` to retrieve the saved draft event data.
-   **[PENDING]** **Task 3:** Modify the `POST /api/organizer/events` endpoint to accept the final, structured data from the step-based workflow.
-   **[PENDING]** **Task 4:** Create a new API endpoint `POST /api/organizer/venues/draft` that allows creating a venue with a `DRAFT` status without requiring a full seating plan. This will be used for on-the-fly venue creation.
-   **[PENDING]** **Task 5:** Refactor the backend logic that uses `inventoryMode` to now use the new `classType` field for all layout-related decisions.
-   **[COMPLETED]** **Task 6:** Update the `GET /api/organizer/events/[id]/layout` endpoint to correctly source the event's seating plan, whether it's from a venue template or a custom event-specific layout.

## Validation

-   **[PENDING]** **Task 1:** Create a Zod schema for each step of the event creation workflow to validate the partial form data before saving it as a draft.
-   **[PENDING]** **Task 2:** Create a comprehensive Zod schema for the final event submission to ensure data integrity before it's saved to the database.
-   **[PENDING]** **Task 3:** Update the `validateTicketClassAssignments` service to use the `classType` field for validating ticket-to-section mappings.

## Frontend

-   **[COMPLETED]** **Task 1: Step Header Component:**
    -   Create a new reusable component, `StepHeader`, that displays the steps of the workflow (Event Details, Ticket Classes, etc.).
    -   The current step should be highlighted.
    -   Completed steps should be visually distinct (e.g., checkmark icon).
-   **[COMPLETED]** **Task 2: Main Workflow Component:**
    -   Create a new component, `EventCreationWorkflow`, that will manage the state of the entire event creation process.
    -   This component will render the `StepHeader` and the appropriate component for the current step.
-   **[COMPLETED]** **Task 3: Step 1 - Event Details:**
    -   Create a new component, `EventDetailsStep`, for the first step.
    -   This component will include the form fields for event details and a venue selection dropdown.
    -   Implement a "+ Create New Venue" button that opens a modal for on-the-fly venue creation.
-   **[COMPLETED]** **Task 4: Step 2 - Ticket Classes:**
    -   Create a new component, `TicketClassesStep`, for the second step.
    -   It will include the form for adding new ticket classes, with the `classType` dropdown.
-   **[COMPLETED]** **Task 5: Step 3 - Layout Setup:**
    -   Create a new component, `LayoutSetupStep`, for the third step.
    -   This component will conditionally render based on the `classType` of the tickets.
    -   It will reuse the existing `LayoutBuilderShell` component for creating the seating plan.
-   **[PENDING]** **Task 6: Step 4 - Assignment:**
    -   Create a new component, `AssignmentStep`, for the fourth step.
    -   This component will display the created sections and allow the organizer to map ticket classes to them.
-   **[COMPLETED]** **Task 7: Step 5 - Review & Publish:**
    -   Create a new component, `ReviewStep`, for the final step.
    -   This component will display a summary of all the entered data.
    -   It will include the "Submit for Approval" button.

## Navigation / UX

-   **[COMPLETED]** **Task 1:** Implement client-side routing to navigate between the steps of the workflow without a full page reload.
-   **[COMPLETED]** **Task 2:** The `StepHeader` should be clickable, allowing the organizer to jump back to previously completed steps.
-   **[COMPLETED]** **Task 3:** When an organizer leaves the event creation flow and comes back later, the system should prompt them to resume their work from the last saved step.
-   **[COMPLETED]** **Task 4:** The "Submit for Approval" button should be disabled until all required steps are completed and the data is valid.

## Persistence

-   **[COMPLETED]** **Task 1:** After each step, automatically save the current state of the form to the backend using the `POST /api/organizer/events/draft` endpoint. This will ensure that the organizer's progress is not lost.
-   **[COMPLETED]** **Task 2:** When the `EventCreationWorkflow` component loads, it should check for a saved draft using the `GET /api/organizer/events/draft` endpoint and pre-fill the form if a draft exists.
-   **[COMPLETED]** **Task 3:** Upon successful submission in the final step, clear the saved draft from the `OrganizerProfile`.
