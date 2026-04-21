# Designing the Layout Trigger UX

This document explains how the organizer is introduced to the layout setup step. The goal is to make this transition feel like a natural and helpful part of the event creation process, rather than an abrupt, technical requirement.

## The Core Principle: Guide, Don't Ask

The system should be smart enough to know when a layout is needed. The organizer should never be asked, "Do you want to add a seating layout?" Instead, the system should guide them to the layout step automatically when it becomes relevant.

## 1. How the System Detects the Need for a Layout

This is an invisible, automatic process from the organizer's perspective.

-   **The Trigger:** As the organizer adds ticket offerings in the "Tickets" step, the system silently keeps track of the *types* of tickets being created.
-   **The Logic:** The moment a ticket type requiring a layout is added (e.g., "Tickets for specific seats" or "Tickets for whole tables"), the system flags this event as needing a layout.
-   **No User Action Required:** The organizer doesn't have to check a box or enable a setting. They just describe their tickets, and the system understands the implications.

## 2. How the Layout Step is Revealed Naturally

The transition from creating tickets to designing the event space should be seamless.

-   **Dynamic Step Header:** As soon as a layout-required ticket is added, the `StepHeader` at the top of the page updates in real-time. The "Seating" step, which may have been previously hidden or disabled, now appears as the clear next step in the workflow. This provides immediate, non-intrusive feedback.
-   **Smart Button Text:** The "Next" button at the end of the "Tickets" step also updates. Instead of a generic "Next", it will say **"Next: Design Your Seating"**. This sets a clear expectation for what is coming next.

## 3. How the Layout Step is Presented

Framing is everything. The layout setup should be presented as a creative, not a technical, task.

-   **The Welcome Message:** When the organizer arrives at the layout step, they are greeted with a simple, helpful message that explains *why* they are here. For example:

    > *"Because you're offering tickets for assigned seats, let's design your event space. If you've used this venue before, we can start with its saved layout."*

-   **Focus on the Outcome:** The language used in this step will focus on the tangible outcome for the event-goer. Instead of "configure sections", the UI might say "Create seating areas". Instead of "map ticket classes", it might say "Assign tickets to areas".
-   **Visual and Forgiving:** The layout builder itself is a visual tool. This reinforces the idea that this is a creative, design-oriented task. The ability to start from a template, and the knowledge that progress is being saved, makes the experience feel low-risk and forgiving.

By following this approach, we avoid exposing the internal logic of the system. The organizer isn't burdened with understanding *why* a layout is needed from a technical standpoint. They are simply guided through a logical sequence of steps that mirrors how they would naturally plan an event: first decide what kind of tickets to sell, then figure out where people will sit.
