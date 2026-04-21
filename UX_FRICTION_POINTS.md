# UX Friction Points

This document identifies specific points in the organizer workflow that create friction, cognitive load, and require the user to understand the system's internal logic.

## 1. The "Wall of Forms" Initial Experience

-   **Friction Point:** The event creation page is a single, long form that asks for all information upfront.
-   **Mental Load:** This creates a high cognitive load for the user. They are forced to think about every detail of the event at once, from the creative aspects (title, description) to the logistical (venue, schedule) and financial (fees, currency).
-   **System Logic:** The user doesn't need to understand system logic here, but the sheer volume of information is overwhelming.

## 2. The Venue "Dead End"

-   **Friction Point:** There is no way to create a new venue from within the event creation flow.
-   **Mental Load:** This is a major point of friction. The user has to stop what they are doing, remember the information they've already entered, navigate to a different part of the application, and then start over.
-   **System Logic:** The user is forced to understand the system's rigid, pre-existing data requirement: `An event can only be created with a venue that already exists in the system.` This is a classic case of the system exposing its internal constraints to the user.

## 3. Seating Plan Duality

-   **Friction Point:** The system has two different types of seating plans: one for the `Venue` (a template) and one for the `Event` (a copy). The relationship between these two is not clear to the user.
-   **Mental Load:** The user has to remember which seating plan they are editing and what the consequences of their edits will be. Will this change affect just this one event, or all future events at this venue? This ambiguity creates anxiety and a fear of making a mistake.
-   **System Logic:** The user has to understand the concept of `EventSeatingPlan` being a *copy* of a venue's template. This is a purely technical, architectural decision that has been exposed in the UI. A user shouldn't have to think about database normalization; they should just think "this is the seating for my event".

## 4. Technical Terminology for Ticket Types

-   **Friction Point:** The use of terms like `inventoryMode` and the subtle distinctions between `seating`, `table`, and `mixed` `classType`.
-   **Mental Load:** The user has to learn the platform's specific terminology. Instead of just describing their tickets ("These are for seats", "These are for tables"), they have to map their real-world concepts to the system's predefined categories.
-   **System Logic:** The user has to understand that `inventoryMode` is a technical field that drives the system's behavior. This is a leaky abstraction. The system should be smart enough to infer the layout requirements from a more natural description of the tickets.

## 5. Lack of a "Draft" State

-   **Friction Point:** There is no way to save an incomplete event and come back to it later.
-   **Mental Load:** This creates a sense of pressure. The user feels like they have to complete the entire event creation process in one sitting. If they get interrupted, they lose their work.
-   **System Logic:** The absence of a draft state is a product decision, but it forces the user to conform to the system's rigid, all-or-nothing approach to data entry.
