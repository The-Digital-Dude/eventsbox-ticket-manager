# Current Gaps and Pain Points

This document highlights the identified gaps, points of confusion, and areas for improvement in the current organizer workflow.

## 1. Disjointed Venue and Event Creation

The most significant gap is the disconnected nature of venue and event creation. The flow is strictly **event-first**, but it requires a **pre-existing, approved venue** if the event is not general admission.

-   **Dead End for New Organizers:** A new organizer who wants to create an event at a new venue will hit a dead end. They will start creating their event, realize they can't add their new venue, and will be forced to abandon the event creation process, navigate to the venue creation section, create the venue, wait for approval, and then come back to create the event.
-   **Loss of Progress:** There is no mechanism to save a draft of an event while the organizer goes to create a venue. This means the organizer will lose all the data they entered in the event creation form.

## 2. Context Switching

The current flow forces organizers to switch context frequently.

-   **Event -> Venue -> Event:** As described above, the organizer has to switch from event creation to venue creation and back.
-   **Event -> Layout -> Event:** After creating an event and adding ticket types, if a layout is required, the organizer is prompted to "Continue Layout Setup". This takes them to a separate page to configure the event's seating plan. After saving the layout, they are taken back to the event detail page. This is a smoother transition than the venue creation flow, but it is still a context switch.

## 3. Confusing Seating Plan Management

The distinction between a `Venue`'s `seatingConfig` and an `Event`'s `EventSeatingPlan` is a subtle but important detail that is likely to confuse organizers.

-   **Two Sources of Truth:** An organizer might update a venue's seating map, expecting it to automatically update all future events at that venue. However, because the event has a *copy* of the seating plan, the changes will not be reflected. This will lead to frustration and support requests.
-   **Lack of Clarity:** The UI does not make it clear that the event's seating plan is a copy. There is no easy way to see if an event's seating plan is out of sync with the venue's template.

## 4. No Support for Unseated Venues with Sections

The current system uses `EventSeatingSectionType` which has `ROWS`, `TABLES` and `SECTIONED_GA`. The `SECTIONED_GA` is a good concept for venues that have general admission sections (e.g., "Front Stage", "Backyard"). However, the workflow for creating a venue and seating map is centered around the `LayoutBuilderShell`, which is designed for creating visual seating maps with rows and tables. It's not clear how an organizer would create a venue with only general admission sections.

## Recommendations for Improvement

-   **Unified Creation Flow:** Allow organizers to create a new venue *during* the event creation process. This could be done with a modal or a separate step within the event creation flow. This would prevent the dead end and loss of progress.
-   **Clearer Seating Plan Management:** Provide clear UI cues to indicate that an event's seating plan is a copy. For example, when editing an event's layout, show a message like "This layout was copied from the '[Venue Name]' template. Changes made here will only apply to this event."
-   **Seating Plan Syncing:** Offer an option to re-sync an event's seating plan with the venue's template. This would allow organizers to easily update multiple events at once.
-   **Improved Workflow for GA Sections:** Create a simplified workflow for creating venues with only general admission sections, without forcing the organizer to use the visual layout builder.
