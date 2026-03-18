# Offline Sync Protocol

## The Core Problem

Two door staff, each with a phone, both offline. The same attendee presents their QR code at both doors. Without network, both devices see the ticket as "not scanned" and both grant entry.

**This is physically unavoidable when fully offline.** No distributed system can prevent this without network communication between the two devices. The correct approach is:

1. Minimise the window of offline divergence (aggressive sync when online)
2. Detect and flag duplicates the moment connectivity returns
3. Give operators clear UI to see what happened

---

## Network States

The app tracks three network states:

```
ONLINE_FAST     — WiFi or strong LTE. Full sync + real-time poll.
ONLINE_SLOW     — Weak signal. Sync attempted, may timeout.
OFFLINE         — No connectivity. Local-only mode.
```

The `StatusPill` component shows this state at all times on the scan screen.

---

## Pre-Event Sync (Seeding)

Before scanning begins, the organiser or scanner **must** seed the local database.

### When:
- Scanner selects an event from the event list
- App automatically starts seed download
- If offline at this point: use last cached seed (show warning with age)

### What is downloaded:
```
GET /api/scanner/events/{eventId}/tickets?cursor=&limit=500
```
Returns paginated list of:
```json
{
  "tickets": [
    {
      "id": "ticket_id",
      "ticketNumber": "T-0012",
      "ticketTypeName": "General Admission",
      "attendeeName": "John Smith",
      "isCheckedIn": false,
      "checkedInAt": null
    }
  ],
  "nextCursor": "...",
  "total": 1200
}
```

### Storage:
- All tickets written to SQLite `tickets` table
- Event metadata written to `events` table
- `events.synced_at` recorded
- Progress shown: "Downloading tickets... 450 / 1200"

### Re-seed:
- Triggered manually via "Refresh" button on event screen
- Also triggered automatically if `synced_at` > 4 hours ago

---

## Scan Flow (Per QR Scan)

```
1. Frame processor extracts ticketId from QR code
2. Debounce: ignore same ticketId within 3 seconds (prevent double-fire)
3. Query SQLite:

   SELECT * FROM tickets WHERE id = ? AND event_id = ?

4a. NOT FOUND:
    → result = INVALID
    → No queue entry written
    → Red flash + error haptic

4b. FOUND, is_checked_in = 1:
    → result = ALREADY_SCANNED
    → Read checked_in_at, checked_in_device from local record
    → Amber flash + warning haptic
    → Show: "Already scanned at [time] — [device name]"

4c. FOUND, is_checked_in = 0:
    → BEGIN TRANSACTION
    → UPDATE tickets SET is_checked_in=1, checked_in_at=NOW(), checked_in_device=DEVICE_ID
    → INSERT INTO scan_queue (id, ticket_id, event_id, scanned_at, device_id, synced=0)
    → COMMIT
    → result = SUCCESS
    → Green flash + success haptic
    → syncService.tryFlush() — attempt immediate upload if online
```

---

## Upload Sync (Draining the Queue)

### Trigger points:
- Immediately after every successful scan (if online)
- Every 10 seconds via background timer (when app is active)
- On app foreground (AppState change)
- On network reconnect (NetInfo event)

### API call:
```
POST /api/scanner/batch-checkin
Authorization: Bearer <token>

{
  "eventId": "evt_xxx",
  "scans": [
    {
      "ticketId": "tkt_abc",
      "scannedAt": "2026-04-01T20:15:33.123Z",
      "deviceId": "device_uuid"
    },
    ...
  ]
}
```

### Server response:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "ticketId": "tkt_abc",
        "outcome": "OK",
        "checkedInAt": "2026-04-01T20:15:33.123Z"
      },
      {
        "ticketId": "tkt_xyz",
        "outcome": "DUPLICATE",
        "firstScannedAt": "2026-04-01T20:15:29.000Z",
        "firstDeviceId": "device_other_uuid",
        "firstDeviceName": "Door 2"
      },
      {
        "ticketId": "tkt_zzz",
        "outcome": "NOT_FOUND"
      }
    ]
  }
}
```

### Client handling:
```
For each result:
  OK        → mark scan_queue row as synced=1
  DUPLICATE → mark scan_queue row as synced=1
              UPDATE tickets SET checked_in_at = firstScannedAt, checked_in_device = firstDeviceId
              increment syncStore.duplicatesFoundAfterSync
              show sticky banner: "⚠ 1 duplicate entry detected"
  NOT_FOUND → mark scan_queue row as synced=1, log warning
              (ticket may have been deleted from the event server-side)
```

---

## Pull Sync (Receiving Other Devices' Scans)

When online, the app polls for scans made on other devices.

### Frequency:
- Every **5 seconds** when app is in foreground and active event is selected
- Paused when app is backgrounded (battery savings)

### API call:
```
GET /api/scanner/events/{eventId}/state?since={lastPullAt}
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "scans": [
      {
        "ticketId": "tkt_abc",
        "checkedInAt": "2026-04-01T20:15:29.000Z",
        "deviceId": "device_other_uuid"
      }
    ],
    "serverTime": "2026-04-01T20:15:40.000Z"
  }
}
```

### Client handling:
```
For each scan received:
  UPDATE tickets SET is_checked_in=1, checked_in_at=?, checked_in_device=?
  WHERE id=? AND is_checked_in=0   ← only update if not already locally scanned

Update syncStore.lastSyncAt = serverTime
```

This means: if Device A (online) scans a ticket and Device B is also online, Device B will see that ticket as scanned within 5 seconds — before the attendee can walk to Door B.

---

## The Two-Door Scenario — Full Walkthrough

### Case 1: Both Online

```
10:00:00  Device A (Door 1) scans Ticket X
          → Local mark + POST /batch-checkin → server records
10:00:01  Server broadcasts (via pull state)
10:00:05  Device B (Door 2) polls → receives Ticket X as checked_in
          → Local SQLite updated: Ticket X = checked_in
10:00:08  Attendee walks to Door 2, scans Ticket X
          → Device B checks SQLite → ALREADY_SCANNED
          → Amber flash: "Already scanned at 10:00:00 — Door 1"
          ✓ Dual entry PREVENTED
```

### Case 2: Both Offline (worst case)

```
10:00:00  Device A (Door 1) scans Ticket X
          → Local mark. scan_queue entry. Unable to upload (offline).
10:00:05  Attendee walks to Door 2. Device B also offline.
          Device B checks SQLite → Ticket X = not_checked_in (last seed was before scan)
          → Device B marks locally as checked_in
          → Dual entry ALLOWED (unavoidable offline)

10:05:00  WiFi restored at venue.
          Device A flushes queue → server records, returns OK
          Device B flushes queue → server returns DUPLICATE (first scan was Device A)
          Device B shows: "⚠ 1 duplicate entry detected after sync"
          Organiser can investigate via the Check-in List
```

### Case 3: One Online, One Offline

```
10:00:00  Device A (Door 1, online) scans Ticket X → server records
10:00:02  Device B (Door 2, offline) — no pull possible
10:00:05  Attendee at Door 2. Device B SQLite has Ticket X as not_checked_in (old seed)
          → Device B grants entry (cannot know about Device A's scan)
          → Same as Case 2 offline outcome
```

### Mitigation for Cases 2 & 3:
- **Pre-event briefing:** seed all devices 15 minutes before doors open on WiFi
- **Connectivity warning:** if offline > 30 seconds, scan screen shows persistent red banner: "OFFLINE — Dual entry risk. Check connectivity."
- **Post-event reconciliation:** sync screen shows any duplicates with timestamps and device names

---

## Background Sync

Uses `expo-background-fetch` + `expo-task-manager`:

```ts
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  const pending = await scanQueueDb.getPending();
  if (pending.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;
  await syncService.flush();
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
  minimumInterval: 30,       // seconds
  stopOnTerminate: false,
  startOnBoot: true,
});
```

This ensures scan queues drain even if the app is backgrounded between venues.

---

## Conflict Attribution — Device Names

Each device has a human-readable name stored in:
- SQLite `devices` table: `{ id, name, registeredAt }`
- Synced to server on first use

Device name defaults to `expo-device.deviceName` (e.g. "iPhone 14", "Pixel 7").
Organiser can rename devices in the EventsBox web panel (future enhancement).
When a duplicate is shown: "Already scanned at 10:00 — iPhone 14 (Door 1)" — the device name comes from the server's device registry.

---

## SQLite Schema

```sql
-- Events available for this scanner
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  start_at     TEXT NOT NULL,
  end_at       TEXT NOT NULL,
  venue_name   TEXT,
  total_tickets INTEGER DEFAULT 0,
  synced_at    TEXT,
  is_active    INTEGER DEFAULT 0
);

-- All tickets for seeded events
CREATE TABLE IF NOT EXISTS tickets (
  id                TEXT PRIMARY KEY,
  event_id          TEXT NOT NULL,
  ticket_number     TEXT NOT NULL,
  ticket_type_name  TEXT,
  attendee_name     TEXT,
  is_checked_in     INTEGER DEFAULT 0,
  checked_in_at     TEXT,
  checked_in_device TEXT,
  sync_status       TEXT DEFAULT 'synced',  -- 'synced' | 'local_pending'
  FOREIGN KEY (event_id) REFERENCES events(id)
);
CREATE INDEX IF NOT EXISTS idx_tickets_event    ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_checkin  ON tickets(event_id, is_checked_in);

-- Outbound scan queue (pending upload)
CREATE TABLE IF NOT EXISTS scan_queue (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  scanned_at  TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  synced      INTEGER DEFAULT 0,
  outcome     TEXT   -- set after server response: 'OK' | 'DUPLICATE' | 'NOT_FOUND'
);
CREATE INDEX IF NOT EXISTS idx_queue_synced ON scan_queue(synced);

-- Device registry
CREATE TABLE IF NOT EXISTS devices (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  registered_at TEXT NOT NULL
);

-- Schema version for migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
```

---

## Schema Migrations

On every app launch:
```ts
const CURRENT_VERSION = 1;

async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(SCHEMA_V1);
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', [1]);
  }
  // future: if (currentVersion < 2) { ... }
}
```
