# A Helpful Validation and Error Handling Strategy

This document outlines a strategy for validation and error handling that is designed to be helpful, clear, and empowering for the event organizer. The guiding principle is that validation should be a guide, not a gatekeeper.

## The Philosophy: Assist, Don't Block

Instead of simply telling the user "You're wrong," the system should say, "It looks like this needs attention. Here's how to fix it." We will never block a user from saving their draft due to a validation error. The only hard block is at the final submission, and even then, the system provides a clear path to resolution.

## The Three Tiers of Helpful Validation

We will implement a three-tiered validation strategy, with each tier providing progressively more comprehensive feedback at the appropriate time.

### Tier 1: Gentle, In-line Validation (As You Type)

-   **When:** This happens immediately, as the organizer is filling out a form field.
-   **What:** It validates basic data formats (e.g., is this a valid email address? Is this a number?).
-   **How it's Shown:** A subtle icon and a soft-colored message appear directly below the field. For example, a small red "x" with the message "Please enter a valid email address."
-   **Goal:** To catch simple typos and formatting mistakes instantly, without interrupting the user's flow.

### Tier 2: Step-Transition Validation (When You Click "Next")

-   **When:** This happens when the organizer clicks the "Next" or "Save & Continue" button to move to the next step.
-   **What:** It validates that all *required* fields for the *current step* are filled out.
-   **How it's Shown:** If there are errors, the workflow does not advance. Instead, the page scrolls to the first field with an error, highlights all invalid fields with a red border, and displays a summary message at the top of the step: *"Please fill out all required fields before continuing."*
-   **Goal:** To ensure each step is self-contained and complete before the user moves on, without being overly aggressive.

### Tier 3: Final Pre-Publish Check (When You Click "Submit")

-   **When:** This is the final, comprehensive check that runs when the organizer clicks "Submit for Approval" in the final Review step.
-   **What:** It validates the entire event object for consistency and completeness across all steps.
-   **How it's Shown:** If validation fails:
    1.  The submission is blocked.
    2.  A clear summary of all issues appears at the top of the Review page.
    3.  Each issue is presented as an **actionable item**, not a raw error message.
    4.  Each item is a link that, when clicked, takes the user *directly* to the step and field that needs to be fixed.

## Handling Specific Scenarios Helpfully

Here's how we would apply this strategy to the specific error cases:

-   **Capacity Mismatch:**
    -   **Old Error:** `SECTION_CAPACITY_EXCEEDED`
    -   **New Experience:** On the "Ticket Assignment" step, a visual warning appears next to the overloaded section. *"Heads up! You've assigned 120 tickets to the 'Balcony' area, which only has a capacity of 100. Please adjust the ticket quantities or the section capacity."* The system doesn't block the user, but it makes the problem impossible to miss.

-   **Missing Assignments:**
    -   **Old Error:** Generic validation failure.
    -   **New Experience:** In the final Review step, the pre-publish check flags this. An actionable error appears: *"The 'VIP' ticket isn't assigned to any seating area. [Click here to assign it.]"* Clicking the link takes the user directly to the assignment step with the "VIP" ticket highlighted.

-   **Incomplete Steps:**
    -   **Old Error:** Disabled publish button with no explanation.
    -   **New Experience:** The "Submit for Approval" button is disabled. A clear message next to it says: *"You can submit once all steps are complete."* The incomplete steps are clearly marked in the `StepHeader` (they don't have a checkmark), providing an immediate visual cue of what still needs to be done.

This helpful validation strategy transforms error handling from a point of frustration into a guided, supportive part of the user journey, ensuring the organizer always feels in control and capable of moving forward.
