# Proposed Step-Based Organizer Workflow

This document outlines a redesigned, step-based workflow for organizers to create and manage events. The goal is to create a continuous and intuitive user journey, removing the dead ends and context switching identified in the current system.

## The Step Flow

The proposed workflow consists of five steps. The organizer can navigate between these steps using a stepper component, and can save their progress at any point.

### Step 1: Event Details (Required)

This is the initial step for creating an event. It combines event and venue creation into a single, seamless experience.

**Contents:**

-   **Event Information:** Title, description, category, schedule, etc.
-   **Venue Selection/Creation:**
    -   Organizers can select an existing, approved venue from a list.
    -   A new, prominent **"+ Create New Venue"** option will be available.
    -   If a new venue is created, a modal or an in-line form will appear to capture the venue details (name, address). The organizer will not be forced to leave the event creation flow.
    -   The new venue will be saved with a `DRAFT` status and will be automatically associated with the event.

**Navigation:**

-   Upon completing the required event details, the organizer can proceed to the next step.

### Step 2: Ticket Classes (Required)

In this step, the organizer defines the types of tickets available for the event.

**Contents:**

-   A form to add ticket classes, including name, price, quantity, and **`classType`** (`General Admission`, `Assigned Seating`, `Table`, `Mixed`).
-   A list of already created ticket classes for the event.

**Navigation:**

-   The organizer can add as many ticket classes as needed.
-   The type of ticket classes created in this step determines whether the subsequent "Layout Setup" and "Assignment" steps are necessary.
-   If only `General Admission` ticket classes are created, the organizer can skip directly to the "Review & Publish" step.

### Step 3: Layout Setup (Conditional)

This step is only required if the organizer has created ticket classes that need a seating or table layout (i.e., `Assigned Seating`, `Table`, or `Mixed`).

**Contents:**

-   The existing `LayoutBuilderShell` component will be used to create the event's seating plan.
-   If the selected venue has a seating template, the organizer will be given the option to start with the template or create a new layout from scratch.
-   The created layout will be saved as an `EventSeatingPlan` associated with the event.

**Navigation:**

-   Once the layout is created, the organizer proceeds to the "Assignment" step.

### Step 4: Assignment (Conditional)

This step is also conditional and follows the "Layout Setup" step. Here, the organizer maps the ticket classes to the sections of the seating plan.

**Contents:**

-   A user-friendly interface to associate each ticket class with one or more sections of the `EventSeatingPlan`.
-   For each section, the UI will display the capacity and the total quantity of tickets mapped to it, preventing over-allocation.

**Navigation:**

-   After all ticket classes have been mapped, the organizer can move to the final step.

### Step 5: Review & Publish (Required)

This is the final step, where the organizer can review all the event details before submitting it for approval.

**Contents:**

-   A comprehensive summary of the event, including:
    -   Event details (title, schedule, etc.)
    -   Venue information.
    -   A list of ticket classes.
    -   A visual representation of the seating plan and the ticket class mappings (if applicable).
-   A prominent **"Submit for Approval"** button.

**Navigation:**

-   The organizer can go back to any of the previous steps to make changes.
-   Submitting the event sends it to the admin for review.

## How this Improves the Flow

-   **Continuity:** The step-based approach provides a clear path and a sense of progression. The organizer is always aware of where they are in the process.
-   **No Dead Ends:** By allowing on-the-fly venue creation, we eliminate the primary dead end in the current workflow.
-   **Reduced Context Switching:** The organizer stays within the event creation and management context from start to finish.
-   **Clarity:** The conditional nature of the "Layout Setup" and "Assignment" steps makes it clear to the organizer what is required of them based on their choices.
