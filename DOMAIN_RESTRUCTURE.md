# Proposed Domain Model Restructure

This document explains the proposed changes to the domain model to support the new, step-based organizer workflow. The goal is to simplify the data model, improve the user experience, and create a more robust and scalable architecture.

## 1. Ticket Classes Belong to Events

**Current Model:** `TicketType` is already correctly associated with an `Event`. This is a core concept that should be maintained.

**Justification:**

-   **Logical Cohesion:** Ticket classes are intrinsically part of an event. They have no meaning or existence outside of the event they are for. Tying them directly to the event is the most logical and intuitive data model.
-   **Simplicity:** This one-to-many relationship (`Event` to `TicketType`) is simple to understand, implement, and query.

## 2. `classType` Drives Layout Behavior

**Current Model:** The `TicketType` has an `inventoryMode` which is then converted to a `classType`. This is an unnecessary layer of indirection.

**Proposed Change:** The `TicketType` model should have a single, clear field, `classType`, which will be an enum of `GENERAL_ADMISSION`, `ASSIGNED_SEAT`, `TABLE`, and `MIXED`. This field will be the single source of truth for determining the layout behavior of the event.

**Justification:**

-   **Improved UX:** The organizer's journey is simplified. They create ticket classes, and the system automatically determines whether a layout is needed based on the `classType` they select. This is a much more intuitive flow than the current system, where the `inventoryMode` is a technical detail that the organizer should not have to worry about.
-   **Simplified Architecture:** By removing the `inventoryMode` and the need for conversion logic, the codebase becomes simpler and easier to maintain.
-   **Clearer Intent:** The `classType` field clearly communicates the intended behavior of the ticket class. This makes the code easier to read and understand for new developers.

## 3. Event-Owned Seating Plan

**Current Model:** The current model, where an `Event` has its own `EventSeatingPlan`, is correct but the workflow around it is confusing.

**Proposed Enhancement:** The new workflow will make the creation and management of the `EventSeatingPlan` more explicit and user-friendly.

-   When an event requires a layout, the system will create an `EventSeatingPlan` for that event.
-   If the event's venue has a seating template, the user will be prompted to either use the template as a starting point (which will copy the `seatingConfig` to the `EventSeatingPlan`) or create a new layout from scratch.
-   All modifications to the layout will be saved to the `EventSeatingPlan`, not the `Venue`'s seating template. The UI will make this clear to the user.

**Justification:**

-   **Flexibility:** This model allows for maximum flexibility. An organizer can have a default layout for a venue, but then customize it for a specific event (e.g., to add a VIP section or remove seats to make space for a stage).
-   **Historical Accuracy:** By giving each event its own seating plan, the system maintains a historical record of the exact layout for each event. This is important for reporting and for managing past orders.
-   **Reduced Confusion:** By making the source of the seating plan explicit and providing clear UI cues, we can eliminate the confusion that exists in the current system.

By implementing these changes, we can create a more intuitive, efficient, and robust platform for both organizers and developers.
