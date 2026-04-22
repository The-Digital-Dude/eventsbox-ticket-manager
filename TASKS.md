# Event Creation Workflow Refactoring Tasks

- [x] **Phase 1: Canonical Event Draft Model** - Define one source of truth for event draft state.
- [x] **Phase 2: Shared Event Engine** - Create shared logic utilities.
- [x] **Phase 3: Draft Persistence** - Save working draft consistently.
- [x] **Phase 4: Step Flow Repair** - Make step sequence derived from event state.
- [x] **Phase 5: Ticket Ownership Cleanup** - Ensure Ticket Options is the source of truth.
- [x] **Phase 6: Auto Layout Generation** - Generate initial layout from ticket quantities.
- [x] **Phase 7: Auto Mapping** - Automatically map ticket classes to targets.
- [x] **Phase 8: Validation** - Implement layered validation.
- [x] **Phase 9: Submit-for-Approval Flow** - Ensure final submit works from draft state.
- [x] **Phase 10: Draft History** - Add versioned history snapshots.
- [x] **Phase 11: UI Cleanup** - Make UI reflect the corrected engine/state model.
- [x] **Phase 12: Event Details Repair** - Refactor Step 1 into the complete organizer-first details, location, schedule, media, policy, and visibility flow with safe timezone-aware datetime handling.
- [x] **Phase 13: Event-First Venue Validation** - Treat inline physical/online event location details as satisfying venue requirements, keeping legacy `venueId` optional for older events.
- [x] **Phase 14: Draft-First Submit** - Submit the saved canonical event draft directly, validate details/tickets/layout/mappings before API write, and remove the duplicate simple-mode payload builder.
