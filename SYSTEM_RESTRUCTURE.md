# System Restructure

## Summary
The current organizer architecture is split across three different authoring centers:

- `Venue` owns seating definition and layout editing
- `Event` owns sellable inventory and lifecycle
- `TicketType` partially depends on seating through `sectionId`, but does not own the seating model it relies on

This creates a structural mismatch: the organizer's real task is "set up an event and sell inventory", but the system makes venue seating the prerequisite source of truth for reserved seating. The result is context switching, hidden coupling, and weak support for event-specific layout changes.

The recommended direction is:

- make the **event flow** the primary authoring surface
- make **ticket types** the first trigger for seating requirements
- move **runtime sellable seating ownership** to the event domain
- keep venue seating as a **reusable template source**, not the live runtime authority

## Current Architecture Problems

### 1. Ownership mismatch
Current code stores seating on `Venue`:

- `Venue.seatingConfig`
- `Venue.seatState`
- organizer venue APIs create and update seating directly

But the seating is operationally consumed by events:

- organizer event detail page reads `event.venue.seatingConfig`
- public event page exposes `event.venue.seatingConfig`
- checkout validates selected seats against `event.venue.seatingConfig`
- `EventSeatBooking` is event-owned, not venue-owned

This means layout authorship is venue-centric, but inventory behavior is event-centric.

### 2. Ticket-to-seating coupling is indirect and fragile
`TicketType.sectionId` is the bridge between ticket inventory and seating sections, but it points into venue-owned layout data rather than a first-class event seating model.

Consequences:

- tickets depend on section identifiers that are not modeled as durable event entities
- seat inventory logic is coupled to venue JSON shape
- changing venue seating risks invalidating ticket mappings for existing or drafted events

### 3. Venue model is overloaded
The current venue module serves three different responsibilities:

- venue/location asset
- seating authoring tool
- runtime seating source for live events

Those responsibilities scale differently and should not share the same ownership boundary.

### 4. Event creation flow is fragmented
Today the organizer must move through separate modules:

1. create venue and seating under `/organizer/venues`
2. create event under `/organizer/events/new`
3. add tickets under `/organizer/events/[id]`

This is backwards for the organizer's mental model. The organizer is not trying to "create a venue with seats"; they are trying to "publish an event with sellable inventory".

### 5. Event-specific layouts are awkward
The current structure makes these common scenarios hard to model cleanly:

- same venue, different event layouts
- same venue, different section pricing across events
- partial closures or blocked areas for one event only
- table setup for one event, row seating for another
- mixed GA + seated inventory on the same event

Because seating is venue-owned, event-specific variation must be forced through a model that was built for reuse, not runtime event control.

## Coupling Issues

### Venue -> Event coupling
- `Event.venueId` is valid and should remain
- `Event` currently depends on venue not only for location, but also for sellable seating behavior
- public event rendering and checkout both assume venue layout is authoritative

This is the wrong dependency direction. Event should depend on venue for place and optional template data, not for live inventory definition.

### Ticket -> Venue coupling
- `TicketType.sectionId` implicitly references sections inside venue seating configuration
- there is no event-owned section entity
- ticket inventory logic therefore depends on venue-authored seat sections

This creates a hidden dependency between ticket configuration and a different module's internal structure.

### Checkout -> Venue coupling
Checkout resolves:

- seat descriptor map from `event.venue.seatingConfig`
- seat availability rules from venue sections
- section quantity matching from venue section membership

That means the live purchase flow is bound to venue seating state, even though seat bookings are stored per event.

## UX Friction Points

### 1. Seating is configured too early and in the wrong place
Venue setup requires seating configuration before the organizer has defined the event inventory that will use it.

This forces the organizer to commit to layout structure before answering the more important question: what kinds of tickets are being sold?

### 2. Tickets do not drive seating behavior
The current UX lets organizers add ticket types only after event creation, and seating awareness appears later through section mapping. The flow should instead infer seating needs from the ticket experience being configured.

### 3. Venue module is an unnecessary detour
For organizers creating one event, venue seating is a detour. It is valuable as a reusable asset, but it should not be the mandatory starting point for making a sellable event.

### 4. Section mapping lacks a clear event context
On the event detail page, ticket types are linked to sections derived from venue seating. That makes the event screen depend on configuration that was authored elsewhere, instead of letting organizers see and manage event inventory in one place.

## Recommended Restructuring

## Target Principles

- **Event-centric runtime model:** live sellable seating belongs to the event
- **Ticket-driven orchestration:** ticket types determine whether seating is required
- **Venue as reusable asset:** venue provides place metadata and optional reusable seating templates
- **Mixed-mode support:** general admission, rows, tables, and mixed layouts must all remain supported
- **Backward-compatible migration:** preserve current venue-based seating reads until event-owned seating is fully established

## Recommended Structure

### 1. Event becomes the runtime source of truth
Event should own:

- whether seating is needed
- which seating mode applies
- which layout snapshot is active for that event
- which sections are sellable for that event

Venue should no longer be the runtime owner of live event seating.

### 2. Ticket types become the seating trigger
Ticket creation should introduce an explicit inventory/experience mode, such as:

- `GENERAL_ADMISSION`
- `ASSIGNED_SEAT`
- `TABLE`
- `MIXED_SECTION`

Default behavior:

- if all tickets are GA, the event stays non-seated
- if any ticket requires seats or tables, the event flow opens seating configuration inline

Manual override should still exist at the event level for edge cases, but ticket-first should be the default orchestration.

### 3. Event seating should be event-owned, template-seeded
Recommended split:

- `Venue`: address, approval, compliance, optional layout template source
- `VenueSeatingTemplate`: reusable template authored once and reused many times
- `EventSeatingPlan`: event-owned runtime snapshot
- `EventSeatingSection`: event-owned sections/zones used by ticket types

This preserves reuse without forcing live event behavior to depend on venue state.

### 4. Venue pages should shift to asset management
`/organizer/venues` should remain useful, but as:

- venue asset management
- template authoring and reuse
- venue approval/status management

It should not remain the primary place where organizers must go to make an event sellable.

## Migration Direction

The restructure should be additive and phased:

1. introduce event-owned seating structures alongside existing venue-based seating
2. backfill seated events from venue seating into event-owned snapshots
3. update organizer event flow to author seating inline
4. migrate ticket mapping from legacy `sectionId` to event-owned section identifiers
5. switch public event and checkout reads to prefer event-owned seating
6. keep venue seating as fallback only for legacy events until cleanup

## End State

In the target architecture:

- organizer creates event first
- organizer defines ticket types
- ticket types determine whether seating is needed
- seating is configured inline for that event
- venue remains reusable, but event owns live sellable layout
- checkout, public event rendering, and seat booking all read from event-owned seating

This produces better cohesion, fewer hidden dependencies, and a flow that matches the organizer's actual goal.
