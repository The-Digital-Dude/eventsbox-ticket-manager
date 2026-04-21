# Redesigning the Ticket Classes Step

This document outlines a redesigned user experience for the "Ticket Classes" step. The goal is to move away from a form-based, data-entry feel and towards a more visual, intuitive, and efficient experience that mimics how an organizer thinks about their ticket offerings.

## The Core Idea: Ticket Cards

Instead of a separate form and a list, each ticket class will be represented as a self-contained **"Ticket Card"**. This makes each ticket offering feel like a real, tangible object.

### Visual Presentation of a Ticket Card

Each card will be visually distinct and will display all the essential information at a glance:

-   **Ticket Name:** Prominently displayed at the top.
-   **Price and Quantity:** Clearly shown.
-   **Ticket Type:** Represented by an icon and a simple label (e.g., "General Admission", "Assigned Seat").
-   **Actions:** A menu or a set of icons for actions like "Edit", "Duplicate", and "Delete".

## Reducing Form Fatigue with Inline Editing

The separate, static form for adding/editing tickets will be eliminated. Instead, we will use inline editing and a more dynamic creation process.

-   **Adding a New Ticket:** A prominent "+ Add a Ticket" button will be available. Clicking it will add a new, blank Ticket Card to the list with its fields ready for editing.
-   **Inline Editing:** To edit any property of an existing ticket (name, price, quantity), the organizer simply clicks on that property directly on the card. The text will turn into an input field, allowing for a quick, in-place edit. Clicking outside the field or pressing Enter saves the change.
-   **Grouped Editing:** When a card is in its "edit" state, all its fields become editable at once, but the interaction is still contained within the card itself. This combines the efficiency of a form with the direct manipulation of the card-based UI.

## Supporting Common Organizer Needs

The new design will directly support the common tasks that organizers perform when setting up tickets.

### 1. Add Another Ticket

-   A large, clear "+ Add a Ticket" button will always be visible, likely at the end of the list of existing ticket cards.

### 2. Duplicate a Ticket

-   **The Problem:** Organizers often have multiple ticket tiers with similar settings (e.g., "Early Bird", "Standard", "Last Minute"). Creating each one from scratch is tedious.
-   **The Solution:** Each Ticket Card will have a "Duplicate" action in its menu. Clicking it will instantly create a new card with the exact same settings as the original, with "(copy)" appended to the name. The organizer can then quickly make the minor changes needed.

### 3. Edit Inline

-   As described above, all fields on the card will be editable in-place, eliminating the need to open a separate form or modal.

### 4. Reorder Ticket Offerings

-   **The Problem:** The order in which tickets are displayed on the public event page matters. The current system doesn't provide an easy way to control this.
-   **The Solution:** The Ticket Cards will be reorderable via **drag-and-drop**. The organizer can simply grab a card and move it up or down in the list to change the display order. A drag handle icon on each card will provide a clear visual cue for this interaction.

By adopting this card-based, visually interactive design, we can transform the ticket creation step from a tedious data-entry task into a fast, fluid, and intuitive experience that aligns with the way event organizers naturally think about their ticket offerings.
