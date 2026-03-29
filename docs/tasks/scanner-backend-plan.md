# Scanner App — Backend Changes Required

This document lists everything that must be added to EventsBox_Ticket_Manager to support the Scanner mobile app.

**Status:** DONE (2026-03-18)

**Note:** Phase 18 (Scanner Role) already adds the `SCANNER` Role enum, scanner account management, and the basic `/api/scanner/checkin` route. This document covers the **additional** endpoints needed by the mobile app that are not in Phase 18.

---

## New API Routes Required

### 1. `GET /api/scanner/events`
List events available for a scanner's organizer.

```ts
// Query params: from, to (ISO date strings)
// Auth: SCANNER or ORGANIZER
// Returns events where organizerProfileId = scanner's org, startAt in [from, to]
// Include: venueName, totalTickets, checkedInCount (count of QRTickets.isCheckedIn)
```

**File:** `app/api/scanner/events/route.ts` (new)

---

### 2. `GET /api/scanner/events/[eventId]/tickets`
Paginated list of all QRTickets for an event — used for pre-sync seed download.

```ts
// Query params: cursor (opaque), limit (max 500)
// Auth: SCANNER (own org) or ORGANIZER
// Returns: id, ticketNumber, ticketTypeName, attendeeName, isCheckedIn, checkedInAt, checkedInDevice
// Cursor: use QRTicket.id as cursor (WHERE id > cursor ORDER BY id)
// Total: count of all QRTickets for event
```

**File:** `app/api/scanner/events/[eventId]/tickets/route.ts` (new)

---

### 3. `POST /api/scanner/batch-checkin`
Batch upload of scan events from the mobile app.

```ts
// Body: { eventId, scans: [{ ticketId, scannedAt, deviceId }] }
// Auth: SCANNER (own org) or ORGANIZER
// For each scan:
//   - Find QRTicket by id, verify belongs to event, verify event belongs to org
//   - If not yet checked in: update QRTicket (isCheckedIn=true, checkedInAt, checkedInDevice)
//     → outcome: "OK"
//   - If already checked in: do NOT update
//     → outcome: "DUPLICATE", include firstScannedAt + firstDeviceId + firstDeviceName
//   - If not found: outcome: "NOT_FOUND"
// Return results array
// Write audit log for each OK check-in
```

**File:** `app/api/scanner/batch-checkin/route.ts` (new)

**Schema change on QRTicket:**
```prisma
// Add to QRTicket model:
isCheckedIn     Boolean   @default(false)
checkedInAt     DateTime?
checkedInDevice String?   // deviceId from the scanning device
```
Migration name: `add-qrticket-checkin-fields`

---

### 4. `GET /api/scanner/events/[eventId]/state`
Pull scan events since a timestamp — enables real-time sync between devices.

```ts
// Query param: since (ISO datetime)
// Auth: SCANNER (own org) or ORGANIZER
// Returns: QRTickets where isCheckedIn=true AND checkedInAt > since AND event.id = eventId
// Also returns: serverTime, totalCheckedIn (count)
// Include deviceName: look up device by checkedInDevice in ScannerDevice table
```

**File:** `app/api/scanner/events/[eventId]/state/route.ts` (new)

---

### 5. `POST /api/scanner/devices`
Register a scanner device. Idempotent.

```ts
// Body: { deviceId: string, name: string }
// Auth: SCANNER or ORGANIZER
// Upsert ScannerDevice { deviceId, name, userId, registeredAt }
```

### 6. `PATCH /api/scanner/devices/[deviceId]`
Update device name.

```ts
// Body: { name: string }
// Auth: SCANNER (own device) or ORGANIZER
```

**Files:** `app/api/scanner/devices/route.ts` + `app/api/scanner/devices/[deviceId]/route.ts` (new)

**New model: `ScannerDevice`**
```prisma
model ScannerDevice {
  deviceId     String   @id
  name         String
  userId       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Migration name: `add-scanner-device`

---

## Changes to Existing Routes

### `app/api/organizer/checkin/route.ts`
The existing single-scan endpoint is used by the organizer web panel scanner page.

After Phase 18 refactors it to use `src/lib/services/checkin.ts`, verify it:
- Still works from the web panel
- Uses the same `QRTicket.isCheckedIn` field (not a separate field)
- Writes `checkedInDevice = null` for web-based check-ins (no device ID available from browser)

---

## Schema Summary

All changes in one migration (`add-scanner-device-and-checkin-fields`):

```prisma
// Extend QRTicket:
isCheckedIn     Boolean   @default(false)
checkedInAt     DateTime?
checkedInDevice String?

// New model:
model ScannerDevice {
  deviceId  String   @id
  name      String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Extend User:
scannerDevices  ScannerDevice[]
```

**Important:** The existing `app/api/organizer/checkin/route.ts` currently marks tickets using a different field (possibly `QRTicket.scannedAt` or similar). Audit this before the migration and ensure the new `isCheckedIn` field is used consistently everywhere after migration.

---

## Rate Limiting

The batch-checkin endpoint can receive large payloads from multiple devices simultaneously during peak check-in. Apply rate limit:
- 10 requests per second per scanner account
- Max 500 scans per batch request

The existing Upstash Redis rate limiter (`src/lib/http/rate-limit-redis.ts`) should handle this.

---

## Integration Tests Required

### `src/tests/integration/scanner-app-api.test.ts`

- GET `/api/scanner/events` — returns organizer's events, SCANNER from other org → 403
- GET `/api/scanner/events/[id]/tickets?limit=2` — returns 2 tickets, cursor for next page
- POST `/api/scanner/batch-checkin` — OK for unscanned, DUPLICATE for already-scanned
- POST `/api/scanner/batch-checkin` with event from different org → 403
- GET `/api/scanner/events/[id]/state?since=oldTimestamp` — returns scans after timestamp
- POST `/api/scanner/devices` — idempotent upsert

---

## When to Build

Build this **after Phase 18** (which adds the SCANNER role and basic account management).

This backend work is a **mini-phase** that can be given to Gemini as its own prompt once Phase 18 is complete. Suggested name: **Phase 18b — Scanner App Backend**.

Estimated scope: 1 Gemini session (~2 hours). The endpoints are straightforward CRUD + auth scope checks.
