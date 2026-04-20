# Target Flow

## Goal

Make event creation the primary organizer workflow and treat ticket classes as the thing that determines whether venue and layout setup are needed.

The organizer should experience one continuous flow instead of switching between separate modules.

## Proposed Organizer Flow

### 1. Create New Event

The organizer starts from `Create New Event`.

They enter the core event details:

- title
- description
- category
- date and time
- banner/image
- location basics
- optional venue selection if one already exists

At this stage, the event is created as a draft shell.

### 2. Define Ticket Classes

After the event shell is created, the organizer continues directly into ticket class setup inside the event flow.

Each ticket class includes:

- `name`
- `price`
- `quantity`
- `classType`

Supported `classType` values:

- `general`
- `seating`
- `table`
- `mixed`

Examples:

- `Regular`, `general`
- `VIP Row A`, `seating`
- `Corporate Table`, `table`
- `Premium Experience`, `mixed`

These are event-owned classes, not venue-owned ticket definitions.

### 3. Detect Layout Requirement

Once at least one ticket class exists, the system derives the event layout requirement from the set of class types.

Derived outcomes:

- only `general` classes -> `no layout`
- one or more `seating` classes and no table requirement -> `seating layout`
- one or more `table` classes and no seat requirement -> `table layout`
- any `mixed` class, or a combination of `seating` and `table`, or a combination that requires multiple inventory modes -> `mixed layout`

This keeps the organizer from having to choose layout architecture before defining what they are actually selling.

### 4. Continue Into Venue and Layout Setup

After ticket classes are saved, the flow continues automatically into venue and layout setup in the same event journey.

The system should carry event context forward:

- `eventId`
- detected layout mode
- whether the organizer arrived from ticket setup

The next step depends on the detected layout mode.

#### No layout

If the event is `general` only:

- organizer can optionally attach a venue
- no seating builder is required
- flow continues to review/publish

#### Seating layout

If the event requires seating:

- organizer selects an existing venue or creates a new one
- existing seating map builder opens inline for this event flow
- organizer configures rows/sections/seats
- ticket classes are mapped to seating sections

#### Table layout

If the event requires tables:

- organizer selects or creates a venue
- existing seating builder is reused in table-oriented mode
- organizer configures tables and capacities
- ticket classes are mapped to table sections or table zones

#### Mixed layout

If the event requires mixed inventory:

- organizer selects or creates a venue
- existing builder is reused with mixed sections
- organizer can configure seated zones, table zones, and general zones in one event layout
- ticket classes are mapped to the relevant zones

### 5. Review Event Setup

After layout setup, the organizer returns to the event context and reviews:

- event details
- ticket classes
- venue assignment
- layout/seating status

The event page should act as the summary and control surface for the entire setup.

### 6. Publish

Once required pieces are complete, the organizer publishes the event.

## Flow Principles

### Event-first

The event is the aggregate root for organizer setup.

### Ticket classes drive behavior

The organizer defines what is being sold first. Layout needs are inferred from those ticket classes.

### Venue supports the flow

Venue remains important, but it should support event setup rather than interrupt it.

### Reuse the existing builder

The current seating map builder should be reused as the layout authoring tool. It should be launched from the event setup flow, not treated as a separate venue-only workflow.

## Result

The organizer flow becomes:

1. create event
2. create ticket classes
3. system detects layout need
4. continue into venue/layout setup in the same flow
5. review and publish

That structure keeps tickets, venue, and layout connected around the event instead of splitting them across unrelated screens.
