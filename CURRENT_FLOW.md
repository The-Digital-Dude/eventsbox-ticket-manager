# Current Flow

## Overview

The current organizer journey is split across separate event and venue screens. It is no longer purely venue-first, but it is also not cleanly event-first. In practice, the organizer flow is mixed and inconsistent.

The current implemented flow is:

1. create an event shell
2. open the event detail page
3. add ticket types on the event detail page
4. after ticket creation, continue into the venue page
5. create or edit venue details and then seating
6. link the created venue back to the event
7. return to the event page

This is a stitched-together flow rather than a single unified event setup flow.

## Step By Step

## 1. Event creation starts on `/organizer/events/new`

Organizer creates a draft event on [page.tsx](D:/AI/eventsbox-ticket-manager/app/organizer/events/new/page.tsx).

Current form includes:

- title
- description
- category
- optional existing venue selection
- location fields
- schedule
- contact details
- hero image / video
- fee configuration
- tags and audience

On submit:

- the page posts to [route.ts](D:/AI/eventsbox-ticket-manager/app/api/organizer/events/route.ts)
- the API creates an `Event`
- success redirects to `/organizer/events/[id]`

Important detail:

- the event can be created without defining any tickets
- the event can optionally reference an existing approved venue at creation time
- no seating map is created in this step

## 2. Ticket creation happens on the event detail page

Organizer then lands on [page.tsx](D:/AI/eventsbox-ticket-manager/app/organizer/events/[id]/page.tsx).

This page acts as the main draft-event management screen.

Current ticket authoring includes:

- name
- description
- kind
- price
- quantity
- max per order
- optional seating section selection if the linked venue already has seating sections

Tickets are posted to:

- [route.ts](D:/AI/eventsbox-ticket-manager/app/api/organizer/events/[id]/tickets/route.ts)

Current behavior after a successful ticket create:

- the page does **not** stay in a self-contained event ticket flow
- it redirects to `/organizer/venues`
- query parameters carry event context:
  - `from=ticket`
  - `eventId`
  - `step=details` or `step=seating`
  - `venueId` when applicable

So the current ticket step is event-owned, but the next step still leaves the event module.

## 3. Venue creation happens on `/organizer/venues`

Organizer venue management lives on [page.tsx](D:/AI/eventsbox-ticket-manager/app/organizer/venues/page.tsx).

This page has a local 2-step UI:

- `details`
- `seating`

In the `details` step the organizer enters:

- venue name
- category
- address
- country/state/city
- optional location search via Places autocomplete

In the `seating` step:

- the existing `SeatMapBuilder` is used
- the organizer configures seat/table sections
- the page saves venue seating, not event seating

Creation and update APIs:

- create venue: [route.ts](D:/AI/eventsbox-ticket-manager/app/api/organizer/venues/route.ts)
- update seating on existing venue: [route.ts](D:/AI/eventsbox-ticket-manager/app/api/organizer/venues/[id]/route.ts)

Important detail:

- a new venue is created together with seating in one submission path
- seating is still authored inside the venue page, not inside the event page

## 4. Seating map creation is still venue-scoped in organizer UX

The actual builder is [seat-map-builder.tsx](D:/AI/eventsbox-ticket-manager/src/components/shared/seat-map-builder.tsx).

It is currently mounted from the venue page, not the event page.

The builder saves:

- `Venue.seatingConfig`
- `Venue.seatState`
- `Venue.totalSeats`
- `Venue.totalTables`

Even though runtime reads have started moving toward event-owned seating support, the organizer authoring flow still creates seating through the venue module.

## 5. Event and venue are connected after venue creation

When venue creation is launched from the ticket flow:

- the venue page receives `eventId`
- after creating the venue, the page calls the event update API
- the event gets patched with the new `venueId`
- the organizer is redirected back to `/organizer/events/[id]`

That linking is handled through:

- [page.tsx](D:/AI/eventsbox-ticket-manager/app/organizer/venues/page.tsx)
- [route.ts](D:/AI/eventsbox-ticket-manager/app/api/organizer/events/[id]/route.ts)

So the event-to-venue connection exists, but only as a cross-page handoff.

## 6. Ticket-to-seating mapping depends on venue sections

Once a venue with seating is linked:

- the event detail page shows seating section options from `event.venue.seatingConfig.sections`
- ticket creation can attach `sectionId`

That means ticket configuration depends on a venue-authored layout already existing.

## Current Architecture Classification

The current architecture is **mixed/inconsistent**.

Why:

- event creation starts in the event module
- ticket creation is event-owned
- but seating map authoring still lives in the venue module
- ticket-to-section mapping depends on venue seating sections
- there is some event-owned runtime seating support in the schema, but organizer authoring does not primarily use it yet

So the current flow is not truly venue-first anymore, but it is also not a complete event-first flow.
