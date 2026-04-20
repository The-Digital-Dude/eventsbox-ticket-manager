# Flow Redesign

## Target Organizer Flow

The organizer flow should be centered on the event, not on venue-first setup.

## Proposed Flow

### 1. Event Creation

Organizer creates the event shell:

- title
- schedule
- venue reference if known
- category
- location
- contact details

At this stage, no layout decisions are required yet.

### 2. Ticket Classes

Inside the event, the organizer defines one or more ticket classes.

Each class includes:

- name
- price
- quantity
- class type
- limits

Organizer-facing class types:

- `General`
- `Seat`
- `Table`
- `Section / Zone`

This is the key redesign point: class type determines whether layout is needed.

### 3. Layout Detection

After ticket classes are defined, the system derives event layout behavior.

#### General case

All classes are `General`:

- no seat map
- no table map
- event is ready to continue

#### Seating case

At least one class is `Seat`:

- open seating builder
- require section mapping for seated classes

#### Table case

At least one class is `Table`:

- open table layout builder
- require table-section mapping

#### Mixed case

Combination of:

- general admission
- seated classes
- table classes

Then:

- open the existing builder in mixed layout mode
- let the organizer create seat sections, table areas, and optional unmapped GA classes

## Recommended Screen Sequence

### Event wizard sequence

1. Event details
2. Ticket classes
3. Layout detection
4. Layout builder if required
5. Review
6. Submit / publish

## Venue Role In The New Flow

Venue should still exist, but as supporting context.

The organizer may:

- select a venue first
- import an existing venue seating template
- ignore venue seating and create a custom event layout

That means venue becomes optional input into layout setup, not a required detour.

## Builder Reuse

The current seat map builder in [seat-map-builder.tsx](D:/AI/eventsbox-ticket-manager/src/components/shared/seat-map-builder.tsx) should be reused, not replaced.

Recommended reuse pattern:

- mount it inside the event flow
- seed it from:
  - venue template
  - prior event layout
  - blank custom layout
- save the result into event-owned layout structures

## Mapping Behavior

After layout is created, ticket classes map to sections naturally.

### General

- no section mapping required

### Seat

- must map to one seating section

### Table

- must map to one table section or table zone

### Mixed

- some classes map
- some classes remain general

## Review Step

Before submission, the organizer should see one combined summary:

- event details
- ticket classes
- derived layout mode
- mapped sections/tables
- venue reference

This removes the current “switch modules and hope it lines up” behavior.

## Minimal-Safe Adoption Path

The flow does not require a full rebuild.

### Phase 1

- keep existing event details page
- keep existing ticket editor
- add class-type-first language
- redirect to inline or contextual layout setup after ticket creation

### Phase 2

- move seat-map builder into event flow
- use venue page only for template management and direct venue editing

### Phase 3

- make event layout the default path
- keep venue-first flow only as optional reusable asset management
