
# Event Creation Workflow Validation Tasks

This document breaks down the implementation of the validation system into a series of tasks.

## Frontend

-   **[COMPLETED]** **Task 1:** Create a shared Zod schema for event creation that can be used by both the frontend and the backend.
-   **[COMPLETED]** **Task 2:** Implement a centralized validation function that takes the Zod schema and the form data and returns a list of validation errors.
-   **[COMPLETED]** **Task 3:** In `EventDetailsStep`, use the centralized validation function to validate the form data and display any errors.
-   **[COMPLETED]** **Task 4:** In `TicketClassesStep`, use the centralized validation function to validate the form data and display any errors.
-   **[COMPLETED]** **Task 5:** In `LayoutSetupStep`, use the centralized validation function to validate the form data and display any errors.
-   **[COMPLETED]** **Task 6:** In `TicketAssignmentStep`, use the centralized validation function to validate the form data and display any errors.
-   **[COMPLETED]** **Task 7:** In `EventCreationWorkflow`, use the centralized validation function to validate the entire form data before submitting for approval.
-   **[COMPLETED]** **Task 8:** Improve the error handling to display clear and actionable error messages to the user.

## Backend

-   **[COMPLETED]** **Task 1:** Update the `POST /api/organizer/events` endpoint to use the shared Zod schema for validation.
-   **[COMPLETED]** **Task 2:** Update the backend to return specific and useful error messages if validation fails.

## UX

-   **[COMPLETED]** **Task 1:** Design and implement a UI to display validation errors in a clear and user-friendly way.
-   **[COMPLETED]** **Task 2:** Auto-generate an initial seating/table layout from ticket quantities before the organizer edits layout details.
-   **[COMPLETED]** **Task 3:** Show required capacity versus generated/current capacity in the layout step and block insufficient layout saves with a helpful message.
-   **[COMPLETED]** **Task 4:** Auto-map generated layout targets to compatible ticket classes by default while preserving manual override.

## API

-   **[COMPLETED]** **Task 1:** Ensure that the API documentation is updated to reflect the new validation rules.
