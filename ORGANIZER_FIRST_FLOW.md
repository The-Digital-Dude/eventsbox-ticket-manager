# The Organizer-First Event Creation Flow

This document outlines a redesigned, organizer-first workflow. The guiding principle is to allow the organizer to describe their event naturally, with the system intelligently adapting and guiding them through any necessary configurations.

## The Continuous Event Setup Experience

The organizer is guided through a linear, step-based process. They always know where they are, what's next, and they can save and exit at any time. The workflow feels less like filling out a form and more like a conversation with a helpful assistant.

### Step 1: Describe Your Event

**Organizer's Goal:** "I want to get the basic idea of my event down."

This step focuses on the creative and essential details. It's about capturing the what, when, and where.

-   **What:** The event's title, a simple description, and the category.
-   **When:** The start and end dates.
-   **Where:** A single location field. The organizer can type the name of a new venue or select an existing one. If they type a new name, the system simply accepts it. No need to create a full venue profile at this stage. The system can use a mapping API to get the address and save it as a `DRAFT` venue in the background.

### Step 2: Define Your Tickets

**Organizer's Goal:** "How am I going to sell tickets for this event?"

This step focuses on what the organizer wants to sell. The language is simple and outcome-oriented.

-   The organizer clicks an "Add Ticket Type" button.
-   They give it a **Name** (e.g., "General Admission", "VIP Table for 6", "Front Row Seat").
-   They set a **Price** and **Quantity**.
-   They choose a **Ticket Type** from a simple dropdown with natural language options:
    -   "Tickets for general admission (no assigned seats)"
    -   "Tickets for specific seats"
    -   "Tickets for whole tables"

### Step 3: System Detects What's Next (Automatic)

This isn't a step the user sees. Based on the ticket types created in Step 2, the system determines the next logical step.

-   If only "general admission" tickets were created, the system skips directly to the final "Review" step.
-   If tickets for "specific seats" or "tables" were created, the system knows a layout is needed and proceeds to the next step.

### Step 4: Adjust Your Layout

**Organizer's Goal:** "I need to arrange the seating for my event."

This step is only shown if required. The system pre-populates it based on previous choices.

-   If the organizer selected an existing venue with a seating template, the layout builder opens with that template already loaded. A clear message says: "We've started you with the layout from [Venue Name]. You can customize it for this event."
-   If it's a new venue, the builder starts with a blank canvas.
-   The organizer visually arranges the seats and tables. They can also map their ticket types to the sections they create (e.g., the "Front Row Seat" ticket type is mapped to the "Front Row" section).

### Step 5: Review & Publish

**Organizer's Goal:** "Does everything look right?"

This is the final confirmation step. It provides a clear, visual summary of the event.

-   Instead of a data dump, it shows a preview of what the public event page will look like.
-   It confirms the event details, ticket types, and a visual summary of the seating plan.
-   A prominent "Publish Event" button gives the organizer the confidence to go live.

## Core Principles of the New Flow

-   **Progressive Disclosure:** The organizer is only shown what they need, when they need it.
-   **Natural Language:** Technical terms are replaced with simple, outcome-oriented language.
-   **Forgiving:** Progress is saved automatically at every step, so the organizer can always resume later.
-   **Intelligent:** The system anticipates the organizer's needs and adapts the workflow accordingly.
