# Draft and Resume UX Strategy

This document explains the user experience for saving and resuming an event draft. The primary goal is to make the organizer feel safe and confident that their progress is never lost.

## 1. How Progress is Saved: Automatic and Explicit

Progress is saved in two ways to provide both convenience and control.

-   **Automatic Saving:** After the successful completion of each step (i.e., when the user clicks "Next"), the workflow automatically saves the entire event draft to the backend. This is the primary mechanism for preventing data loss.
-   **Explicit "Save Draft" Button (Optional but Recommended):** A subtle "Save and Exit" button could be present in the main workflow header. This gives the organizer an explicit way to save their work if they need to leave in the middle of a step, providing an extra layer of reassurance.

## 2. How Saved State is Shown in the Workflow

Constant, clear feedback is key to making the organizer feel secure.

-   **The Save Status Indicator:** The `StepHeader` will have a dedicated area in the top-right corner to display the save status.
    -   **While Saving:** It will show a subtle spinner and the text "Saving...".
    -   **After a Successful Save:** It will briefly show "Saved!" and then transition to a persistent "Last saved at [time]" message.
    -   **If a Save Fails:** It will show a red "Save failed" message, and a toast notification will appear with more details.

## 3. How Drafts Appear in the Organizer Dashboard

An unfinished event is a work in progress, and it should be treated as such in the main dashboard.

-   **A Dedicated "Drafts" Section:** The organizer dashboard will have a new section at the top, clearly labeled **"In-Progress Events"** or **"Drafts"**.
-   **The Draft Card:** Each draft will be represented by a card with the event's title (or "Untitled Event" if Step 1 is not complete).
-   **Clear Call to Action:** The card will have a single, prominent button: **"Continue Setup"**. It will also show the `lastSaved` timestamp.
-   **Visual Distinction:** Draft event cards will have a distinct visual style (e.g., a dashed border, a "Draft" badge) to differentiate them from published or pending events.

## 4. How the User Resumes an In-Progress Event

The resume experience should be seamless and intelligent.

-   **The Welcome Back Prompt:** When the organizer clicks "Continue Setup" on a draft card, they are taken to the event creation workflow. A brief, welcoming toast notification appears: *"Welcome back! Let's pick up where you left off."*
-   **Automatic State Restoration:** The system automatically loads the entire draft, populates all the data for the completed steps, and navigates the user directly to the correct next step. For example, if they had completed Step 2 and a layout is required, they will land on Step 3.

This comprehensive draft, save, and resume strategy ensures that the organizer feels their work is always safe. It removes the fear of losing progress, reduces frustration, and makes the entire event creation process feel more like a forgiving and supportive partnership with the platform.
