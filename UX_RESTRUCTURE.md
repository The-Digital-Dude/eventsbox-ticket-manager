# UX Restructure for an Organizer-First Flow

This document details the necessary changes in navigation, grouping, labels, and interaction design to support the new, organizer-first workflow.

## 1. Navigation and Grouping

-   **Single, Continuous Workflow:** The separate pages for creating events, venues, and layouts will be consolidated into a single, continuous, step-based workflow. The main entry point will be "+ New Event".

-   **Visual Stepper:** A prominent `StepHeader` component will be always visible at the top of the page. This will serve as the primary navigation for the workflow, showing the user where they are, what they've completed, and what's next. The steps will be clickable, allowing the user to go back to any completed step.

-   **Modal for On-the-Fly Creation:** When a user needs to create a new venue, instead of being redirected to a different page, a modal or an inline form will appear. This keeps the user in the context of their event creation flow.

-   **Logical Grouping of Fields:** The long, overwhelming form will be broken down into logical steps. Each step will have a clear goal and will only ask for the information relevant to that goal. For example, Step 1 focuses on the event's core identity, while Step 2 focuses on the commercial aspect (tickets).

## 2. Labels and Language

-   **Use Natural Language:** All technical jargon will be replaced with simple, user-friendly language. The goal is to speak the organizer's language, not the developer's.

| Old Terminology | New Label | Explanation |
|---|---|---|
| `inventoryMode` | Ticket Type | This is a more intuitive term for the user. |
| `classType` | (Removed from UI) | This is an internal system concept. The user will select a "Ticket Type" with a descriptive label. |
| `seating`, `table`, `mixed` | "Tickets for specific seats", "Tickets for whole tables" | The options in the "Ticket Type" dropdown will be descriptive sentences that explain the outcome. |
| `EventSeatingPlan` | Your Event's Layout | The UI will use possessive and descriptive language to clarify the ownership of the seating plan. |

-   **Action-Oriented Button Labels:** Button labels will be clear and will describe the action that will be performed. For example, instead of a generic "Save", the buttons will say "Save & Continue" or "Submit for Approval".

## 3. Interaction Design

-   **Live Preview:** To provide a more engaging and rewarding experience, the "Review & Publish" step will feature a live preview of the public event page. This will give the organizer a real sense of accomplishment and will allow them to see their event come to life as they build it.

-   **Smart Defaults:** The system will provide smart defaults wherever possible. For example, if a venue has a seating template, the layout builder will start with that template, reducing the amount of work for the organizer.

-   **Clear Messaging on Layout Copying:** When an organizer starts with a venue's seating template, a clear, non-dismissible message will be displayed: *"We've started you with the layout from [Venue Name]. You can customize it for this event without affecting the venue's template."* This will eliminate the confusion around the two sources of truth for seating plans.

-   **Forgiving Interactions:**
    -   **Auto-Save:** The system will automatically save the organizer's progress after each step, with a clear UI indicator of the save status.
    -   **Resume Prompt:** When an organizer returns to an incomplete event, they will be greeted with a prompt: *"Welcome back! Would you like to continue where you left off?"*

By implementing these UX changes, we will transform the platform from a rigid, technical tool into a smooth, intuitive, and forgiving creative partner for event organizers.
