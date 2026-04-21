# Step Workflow Behavior

This document defines the navigation logic and behavior of the step-based event creation workflow. The goal is to create a flow that is both structured and flexible, guiding the user while allowing them to make corrections easily.

## 1. Step Progression

-   **Linear Flow:** The primary path through the workflow is linear. The user proceeds from one step to the next by clicking the "Next" or "Save & Continue" button.
-   **Automatic Saving:** Each time the user completes a step and moves to the next, the data for the completed step is automatically saved to the backend as a draft. This ensures no work is lost.

## 2. Step States and Editability

-   **Completed Steps are Editable:** An organizer can navigate back to any previously completed step to make changes. The `StepHeader` will provide the primary UI for this, with completed steps being clickable.
-   **Future Steps are Locked:** An organizer cannot jump ahead to a step that has not yet been completed. The corresponding steps in the `StepHeader` will be visually disabled and not clickable. This prevents the user from getting lost or entering data in the wrong order.

## 3. Conditional Steps

The workflow is intelligent and adapts to the user's choices.

-   **Layout and Assignment Steps:** Steps 3 ("Seating") and 4 ("Ticket Assignment") are **conditional**. They are only shown if the organizer creates ticket types that require a seating layout in Step 2.
-   **Automatic Skipping:** If, after completing Step 2, the system detects that all ticket classes are for general admission, it will automatically skip Steps 3 and 4 and take the user directly to Step 5 ("Review & Publish").
-   **Smart "Back" Navigation:** The "Back" button is also smart. If a user is on Step 5 and the layout steps were skipped, clicking "Back" will take them to Step 2, not Step 4. This creates a logical and seamless navigation experience.

## 4. The Organizer is Never Trapped

This design ensures that the organizer never feels stuck or confused.

-   **Clear Path:** The `StepHeader` always shows the full path and the user's current position within it.
-   **Freedom to Correct:** The ability to go back to any completed step means the organizer doesn't have to worry about making a mistake. They can always go back and fix it without losing their progress in subsequent steps.
-   **Resume Functionality:** If the organizer leaves the workflow for any reason, they can return later and resume from the exact step where they left off. The system will load their draft and restore the state of the workflow.

This combination of a guided linear path with the flexibility to edit and the safety net of auto-save and resume creates a user experience that is reassuring, forgiving, and empowering for the event organizer.
