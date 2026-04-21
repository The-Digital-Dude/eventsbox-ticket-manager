# Simple vs. Advanced Event Creation Modes

This document outlines a strategy for providing two distinct modes for event creation: a **Simple Mode** for quick, general admission events, and an **Advanced Mode** for complex events requiring full control. The goal is to cater to both beginner and power users without creating two separate systems.

## The Core Principle: One System, Two Doors

We will not build two different event creation systems. Instead, we will build a single, robust, step-based system (the "Advanced Mode") and create a simplified entry point to it (the "Simple Mode"). The Simple Mode is a shortcut, not a separate path.

## 1. How the Organizer Chooses a Mode

Immediately after clicking "+ New Event", the organizer is presented with a clear choice based on the *type* of event they are creating, not on their skill level.

> **What kind of event are you creating?**
>
> -   **A Simple Event**
>     -   *General admission, no assigned seating.*
>     -   [Choose this option]
>
> -   **A Custom Event**
>     -   *Assigned seating, tables, multiple ticket tiers, or other special requirements.*
>     -   [Choose this option]

Choosing "A Simple Event" takes them to the Simple Mode. Choosing "A Custom Event" takes them to the Advanced (step-based) Mode.

## 2. What Belongs in Simple Mode

Simple Mode is a single, clean, one-page form that only asks for the absolute essentials to get a general admission event live.

-   **Event Basics:** Event Name, Date, Time, and Venue Address.
-   **A Single Ticket Type:** A simplified section to create one general admission ticket. It will only ask for the Ticket Name (e.g., "General Admission"), Price, and Quantity.
-   **A Single "Publish Event" Button:** At the end of the form, there is one button to publish the event.

**What is explicitly excluded:** Multiple ticket types, seating layouts, detailed fee configuration, cancellation policies, etc.

## 3. What Belongs in Advanced Mode

Advanced Mode is the full, five-step workflow that has been previously designed. It provides access to all features and full control over every aspect of the event.

-   **Step 1: The Event** (Includes on-the-fly venue creation)
-   **Step 2: Tickets** (Multiple ticket types with different `classType` options)
-   **Step 3: Seating** (Conditional, uses the visual layout builder)
-   **Step 4: Ticket Assignment** (Conditional)
-   **Step 5: Review & Publish**

## 4. How to Avoid Duplicating Logic

The Simple Mode form is a facade. When the organizer fills it out and clicks "Publish Event":

1.  The system takes the data from the simple form and internally maps it to the data structure of the advanced workflow's draft model. The event details map to `formData.step1`, and the single ticket offering maps to `formData.step2` (as an array with one `general` ticket).
2.  The system then runs the same final, pre-publish validation logic that the Advanced Mode uses.
3.  If valid, it calls the same `POST /api/organizer/events` endpoint to create the event.

By treating the Simple Mode as a shortcut that populates the same data model as the Advanced Mode, we reuse all of the backend logic, validation, and data structures. The only new code is the UI for the simple, one-page form.

## 5. How to Move from Simple to Advanced Safely

An organizer might start with a simple event and later decide they need more advanced options. The transition should be seamless.

-   **The "Convert to Custom Event" Button:** On the event detail page for an event created via Simple Mode, there will be a clear button: **"Switch to Advanced Setup"**.
-   **The Transition:** Clicking this button will:
    1.  Not change any of the existing event data.
    2.  Simply unlock the full, step-based workflow UI for that event.
    3.  The organizer will be taken to the `EventCreationWorkflow` component, with all steps populated with the data they entered in the simple form. They can then, for example, navigate to Step 2 to add more ticket types or to Step 3 to add a seating layout.

This strategy provides the best of both worlds: a fast, streamlined experience for simple events and a powerful, flexible workflow for advanced events, all built on a single, consistent architecture.
