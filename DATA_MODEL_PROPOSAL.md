# Data Model Proposal

## Goal

Reorganize the domain so that:

- `Event` is the organizer-facing aggregate root
- `TicketClass` is the event-owned sellable unit
- ticket class type drives layout behavior
- venue remains reusable but no longer owns the runtime flow
- the existing seating builder can populate an event-owned seating map

## Proposed Relationships

### Event

`Event` should remain the top-level organizer entity.

It should own:

- event metadata
- venue assignment
- ticket classes
- derived layout mode
- active event seating map

Suggested conceptual shape:

- `id`
- `organizerId`
- `venueId?`
- `title`
- `status`
- `layoutMode`
- `ticketClasses[]`
- `seatingMap?`

### TicketClass

`TicketClass` is the conceptual replacement for the current `TicketType`.

It belongs to exactly one event.

It should describe:

- the name of the class
- price
- quantity
- class type
- optional mapping to a seating section or table zone

Suggested conceptual shape:

- `id`
- `eventId`
- `name`
- `description?`
- `price`
- `quantity`
- `soldCount`
- `reservedCount`
- `maxPerOrder`
- `classType`
- `sectionId?`
- `tableGroupId?`
- `sortOrder`

Supported `classType` values:

- `general`
- `seating`
- `table`
- `mixed`

### Venue

`Venue` should represent the physical place and reusable venue-level assets.

It should not be the primary source of runtime sales layout.

Venue should own:

- place identity
- address data
- optional reusable layout templates

Suggested conceptual shape:

- `id`
- `name`
- `address`
- `city`
- `state`
- `country`
- `capacity?`
- `layoutTemplates[]`

### SeatingMap

`SeatingMap` should be event-owned at runtime.

It may be:

- created from scratch inside the event flow
- copied from a venue template
- customized per event after selection

Suggested conceptual shape:

- `id`
- `eventId`
- `venueId?`
- `mode`
- `sourceType`
- `sourceTemplateId?`
- `sections[]`

Suggested `mode` values:

- `no_layout`
- `seating_layout`
- `table_layout`
- `mixed_layout`

### Section

`Section` should be an event-level partition inside a seating map.

It allows ticket classes to map to distinct areas of the event layout.

Suggested conceptual shape:

- `id`
- `seatingMapId`
- `name`
- `sectionType`
- `capacity?`
- `sortOrder`
- `tables[]`

Suggested `sectionType` values:

- `general`
- `seat_section`
- `table_section`
- `mixed_section`

### Table

`Table` should belong to a section within an event seating map.

This makes table-oriented inventory first-class instead of leaving it trapped in an opaque JSON blob.

Suggested conceptual shape:

- `id`
- `sectionId`
- `name`
- `capacity`
- `sortOrder`
- `positionData?`

## Recommended Cardinality

- `Event 1 -> many TicketClass`
- `Event 1 -> 0..1 Venue`
- `Event 1 -> 0..1 SeatingMap`
- `SeatingMap 1 -> many Section`
- `Section 1 -> many Table`
- `TicketClass many -> 0..1 Section`
- `TicketClass many -> 0..1 TableGroup/Section area`

## How Layout Should Be Derived

The event layout mode should be computed from the set of ticket class types.

### Rules

- all ticket classes are `general` -> `no_layout`
- any `seating` classes, without table behavior -> `seating_layout`
- any `table` classes, without seat behavior -> `table_layout`
- any `mixed` class, or any combination of seat and table requirements -> `mixed_layout`

This can be stored on the event for convenience, but it should always be conceptually derived from ticket classes.

## Recommended Backward-Compatible Mapping

The system does not need a destructive rewrite.

### Near-term interpretation of current models

- current `TicketType` -> conceptual `TicketClass`
- current `EventSeatingPlan` -> conceptual `SeatingMap`
- current `EventSeatingSection` -> conceptual `Section`
- current `VenueSeatingTemplate` -> venue-level layout template source

### Current fields that can be reinterpreted

- `TicketType.inventoryMode` can evolve into organizer-facing `classType`
- `TicketType.eventSeatingSectionId` can remain the primary section mapping field
- `Event.seatingMode` can store the event-derived layout mode

### Venue compatibility

Existing venue-based seating should remain supported by treating it as:

- a reusable template source
- a legacy fallback for events that still rely on venue seating config

That preserves existing behavior while shifting ownership toward the event.

## Practical Model Direction

### Event as runtime owner

Checkout, seat selection, and availability should resolve against the event-owned seating map.

### Venue as reusable source

Venue can offer:

- reusable rows/sections layout
- reusable table arrangements
- reusable mixed templates

But once an organizer is configuring a specific event, the active runtime layout should belong to that event.

## Resulting Conceptual Model

The target model becomes:

- `Event`
  - owns `TicketClass`
  - derives `layoutMode`
  - owns active `SeatingMap`
- `Venue`
  - supplies place context
  - optionally supplies reusable templates
- `SeatingMap`
  - contains `Section`
  - contains `Table` where relevant
- `TicketClass`
  - maps into the seating map when layout is required

That structure supports:

- general admission events
- reserved seating events
- table-based events
- mixed inventory events

without splitting the organizer flow across unrelated modules.
