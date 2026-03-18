# EventsBox Scanner App — Overview

## Purpose

A standalone mobile app for event check-in scanning. Built for door staff at events run through the EventsBox platform. Scanner accounts are created by organizers inside the EventsBox Ticket Manager and can only log in to this app — they have no access to the main web panel.

## Core Problems Solved

1. **Offline scanning** — venue basements, festivals, and weak-signal venues must still work
2. **Dual-entry prevention** — two doors with the same ticket must not both grant entry
3. **Real-time sync** — when online, scans on one device are immediately visible to all devices at the same event
4. **Retroactive conflict detection** — if two offline devices both scan the same ticket, they detect and flag it the moment connectivity returns

## Platform

- iOS (iPhone, minimum iOS 16)
- Android (minimum API 33 / Android 13)
- Built with Expo + React Native (single codebase)

## Design Language

Inspired by modern event scanner apps (Universe, Eventbrite Organizer, Square Terminal).

- **Dark theme** — optimised for low-light venue conditions
- **Full-screen camera** — maximum viewfinder, minimal chrome
- **High-contrast status** — green / red / amber flashes with haptic feedback
- **Single-purpose UI** — zero clutter on the scan screen

## Key Constraints

- Must work with zero internet (full offline mode)
- Must gracefully degrade: online → degraded → offline with clear status indicators
- Auth tokens stored securely on device (expo-secure-store)
- Ticket data stored locally in SQLite (expo-sqlite)
- App must work without a dedicated WebSocket server — uses short-poll + batch sync

## What Is Out of Scope

- Payment processing (Stripe) — this is check-in only
- Organizer event management — that lives in the web app
- Attendee-facing features — this is staff only
