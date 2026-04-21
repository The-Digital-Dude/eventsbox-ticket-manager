# Final Organizer Flow Summary

This document describes the final, implemented organizer workflow for creating a new event. The new workflow is a step-based, continuous journey that saves progress and allows organizers to resume their work at any time.

## The Event Creation Flow

The workflow is presented as a series of steps in a consistent UI. The organizer can navigate between completed steps using the header.

### 1. Create Event (Event Details)

-   This is the first step in the process.
-   The organizer fills out the basic details of the event, such as title, description, schedule, and venue.
-   **Improvement:** The design allows for on-the-fly venue creation (not yet implemented), which will prevent the organizer from having to leave the workflow to create a new venue.

### 2. Define Ticket Offerings

-   The organizer defines the ticket classes for the event.
-   The UI for this step is card-based, allowing for inline editing, duplication, and reordering of ticket offerings.
-   Each ticket class has a `name`, `price`, `quantity`, and a `classType` selected from a user-friendly dropdown.

### 3. Automatic Layout Detection

-   This is a logical step that happens automatically after the completion of Step 2.
-   The centralized `deriveLayoutFromTicketClasses` function inspects the `classType` of all ticket classes.
-   If any ticket class is `seating`, `table`, or `mixed`, the workflow determines that a layout is required.
-   If all ticket classes are `general`, the layout and assignment steps are skipped.

### 4. Event Space Setup

-   This step is conditional and only appears if a layout is required.
-   It reuses the existing `LayoutBuilderShell` to provide a powerful and familiar experience for creating seating maps.
-   The organizer can create a custom layout for the event or start from a venue's template (if available).

### 5. Save and Resume

-   **Automatic Saving:** After each step is submitted, the form data is automatically saved to the backend as a draft.
-   **UI Feedback:** The UI provides clear feedback on the save status ("Saving...", "Last saved at...").
-   **Resume Functionality:** If an organizer leaves the workflow and returns later, the system automatically loads the saved draft, repopulates the form, and returns them to the exact step where they left off.

### 6. Review and Publish

-   This is the final step.
-   It displays a comprehensive summary of all the data entered in the previous steps.
-   It includes a validation check (`canPublish`) to ensure all required steps have been completed.
-   The "Submit for Approval" button is only enabled when the event is ready for submission.
-   If there are validation errors, they are displayed as a list of actionable links that take the user to the exact step to fix the issue.
-   Upon submission, the event is created in the database, and the draft is cleared.

This new workflow addresses the major pain points of the old system, providing a more intuitive, efficient, and user-friendly experience for event organizers.
