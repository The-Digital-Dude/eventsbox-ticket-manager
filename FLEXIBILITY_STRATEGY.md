# Workflow Flexibility Strategy

This document outlines a strategy for creating a flexible, non-restrictive event creation workflow. The goal is to balance guided, step-by-step progression with the freedom for the organizer to move back and forth, make changes, and never feel trapped.

## 1. Editing Earlier Steps

**The Rule:** Any step that has been completed is always editable.

-   **Interaction:** The organizer can click on any completed step in the `StepHeader` to navigate directly back to it.
-   **Data Persistence:** When the user navigates back, the form for that step is pre-populated with the previously saved data. They can make their changes and then proceed forward again by clicking "Next".
-   **Re-validation:** When the user submits a previously completed step again, the data for that step is re-validated and re-saved. The system then intelligently determines the next logical step.

## 2. Handling Conditional Steps and State Invalidation

This is the core of the flexibility strategy. The system must gracefully handle changes that affect the visibility of future, conditional steps.

**Scenario:** An organizer initially creates a `seating` ticket (Step 2), proceeds to create a layout (Step 3), and then navigates back to Step 2 to change the ticket to `general`.

-   **The Principle: Don't Destroy Data, Invalidate Progress.** The system should not immediately delete the layout data from Step 3. The organizer may have spent significant time on it and might change their mind again.

-   **The Behavior:**
    1.  The organizer goes back to Step 2 and changes the ticket type.
    2.  They click "Next: Review & Publish" (since the system now detects no layout is needed).
    3.  The `completedSteps` state is updated. Step 3 ("Seating") and Step 4 ("Ticket Assignment") are no longer marked as complete.
    4.  The organizer is taken to Step 5 ("Review & Publish"). The review screen now shows no layout information.

-   **What happens to the old layout data?** It is still stored in the draft (`formData.step3`), but it is now considered "orphaned". If the user goes back to Step 2 *again* and re-adds a `seating` ticket, when they arrive at Step 3, the form will be pre-populated with their previously created layout. This is a forgiving experience that respects the user's effort.

## 3. Balancing Freedom with Validation

The goal is to guide the user, not to restrict them. We achieve this with a multi-layered validation approach.

-   **Tier 1: In-line Field Validation:** Basic format validation (e.g., valid email, numbers only) happens as the user types, providing immediate feedback without being intrusive.

-   **Tier 2: Step Transition Validation:** When the user clicks "Next", the system validates that all *required* fields for the *current step* are complete. If not, it highlights the missing fields and prevents progression. This ensures that each step is self-contained and complete before moving on.

-   **Tier 3: Publish-Time Validation:** This is the final gatekeeper. It validates the entire event object just before it's submitted for approval.

## 4. Publish-Time Validation

This is the final check to ensure the event is consistent and ready to be published.

-   **How it Works:** When the organizer clicks "Submit for Approval" on the final step, the system runs a full validation on the entire `formData` object.
-   **Error Handling:** If validation fails:
    1.  The submission is blocked.
    2.  A clear, user-friendly summary of all errors is displayed at the top of the Review page (e.g., "Please fix the following issues before publishing:").
    3.  Each error message is a clickable link that takes the user *directly* to the step and the specific field that needs correction.
    4.  The corresponding step in the `StepHeader` is also marked with an error icon.

This strategy ensures that the user is never blocked from saving their draft or navigating between completed steps. The workflow feels open and flexible, but the final publish action is protected by a robust and helpful validation process.
