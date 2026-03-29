# EventsBox Scanner App — Master Plan (Locked)

**Version:** 1.0 — Final
**Date:** 2026-03-19
**Status:** LOCKED — no new phases or scope additions without explicit sign-off

---

## 1. Context & What Is Already Done

The scanner mobile app is **Phase 26** of EventsBox — the final phase. Everything below this app is already built and deployed.

### Backend: 100% Complete

All scanner API endpoints are live and deployed on Vercel:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` | Scanner login → access + refresh tokens |
| `POST /api/auth/refresh` | Rotate expired access token |
| `GET /api/scanner/events` | List events scoped to this scanner's organizer |
| `GET /api/scanner/events/{id}/tickets` | Download all tickets (cursor paginated, 500/page) |
| `POST /api/scanner/batch-checkin` | Submit scanned QR codes, get OK/DUPLICATE/NOT_FOUND |
| `GET /api/scanner/events/{id}/state` | Poll other devices' scans since a timestamp |
| `POST /api/scanner/devices` | Register device (idempotent) |
| `PATCH /api/scanner/devices/{id}` | Rename device |

### Database: 100% Complete

```
ScannerProfile   — links User(SCANNER role) → OrganizerProfile
ScannerDevice    — device registry (deviceId, name, userId)
QRTicket         — tickets with isCheckedIn, checkedInAt, checkedInDevice
```

### The App's Job

- Give venue staff a phone app that scans QR codes from attendees' ticket wallets
- Works fully offline (no internet required to scan once event is seeded)
- Prevents double-entry even when two doors are scanning simultaneously
- Syncs all check-ins to the server when connectivity returns

---

## 2. Tech Stack (Locked — Do Not Change)

| Concern | Technology | Version |
|---------|-----------|---------|
| Framework | Expo (managed workflow) | SDK 52 |
| Language | TypeScript | 5.x |
| Navigation | Expo Router | 4.x |
| Camera / QR decode | react-native-vision-camera + vision-camera-code-scanner | v4 |
| Local database | expo-sqlite | v14 |
| State management | Zustand | v5 |
| Server state / caching | @tanstack/react-query | v5 |
| Styling | NativeWind (Tailwind for RN) | v4 |
| Animations | react-native-reanimated | v3 |
| Haptics | expo-haptics | SDK 52 |
| Secure token storage | expo-secure-store | SDK 52 |
| Background sync | expo-background-fetch + expo-task-manager | SDK 52 |
| Network detection | @react-native-community/netinfo | latest |
| Virtual lists | @shopify/flash-list | latest |
| OTA updates | expo-updates | SDK 52 |
| Device info | expo-device + expo-application | SDK 52 |
| Build & deploy | EAS Build + EAS Submit | latest |
| ID generation | nanoid | v5 |

**No other packages without explicit approval.**

---

## 3. Repository

```
Location:    ~/Developer/TDD/EventsBox/EventsBox_Scanner_App/
Git remote:  github.com/[org]/EventsBox_Scanner_App
Branch:      main
```

This is a **separate repository** from `EventsBox_Ticket_Manager`. The two repos share nothing except the API.

---

## 4. Directory Structure (Canonical — Do Not Deviate)

```
EventsBox_Scanner_App/
├── app/
│   ├── _layout.tsx              # Root: DB init, auth hydration, QueryClient
│   ├── index.tsx                # Redirect → /login or /(app)/events
│   ├── login.tsx                # Login screen
│   └── (app)/
│       ├── _layout.tsx          # Auth guard (redirect if no token)
│       ├── events/
│       │   ├── index.tsx        # Event selector screen
│       │   └── [eventId]/
│       │       ├── scan.tsx     # Main scan screen (camera + QR)
│       │       ├── list.tsx     # Check-in list screen
│       │       └── stats.tsx    # Event stats screen
│       └── settings.tsx         # Settings screen
│
├── src/
│   ├── constants/
│   │   ├── colors.ts            # Design tokens (dark theme palette)
│   │   └── config.ts            # API_BASE_URL, poll intervals, thresholds
│   │
│   ├── db/
│   │   ├── client.ts            # SQLite singleton (openDatabaseAsync)
│   │   ├── schema.ts            # CREATE TABLE statements + migration runner
│   │   ├── tickets.ts           # getTicket, markCheckedIn, search, getByEvent
│   │   ├── events.ts            # upsertEvent, getEvents, getEvent
│   │   └── scan-queue.ts        # enqueue, getPending, markSynced, getCount
│   │
│   ├── services/
│   │   ├── api.ts               # Typed fetch wrapper (Bearer inject, 401 retry, timeout)
│   │   ├── auth.ts              # login(), logout(), refreshToken()
│   │   ├── checkin.ts           # performCheckin() — SQLite write + queue enqueue
│   │   ├── pre-sync.ts          # downloadTickets() — cursor-paginated seed
│   │   └── sync.ts              # flush() upload + pullState() poll + background task
│   │
│   ├── store/
│   │   ├── auth.ts              # Zustand: token, refreshToken, scanner, setAuth, clearAuth
│   │   └── sync.ts              # Zustand: status, pendingCount, lastSyncAt, duplicates
│   │
│   ├── hooks/
│   │   ├── useCheckin.ts        # Wraps checkin service, exposes to scan screen
│   │   ├── useSync.ts           # Manages flush/pull intervals
│   │   ├── useNetworkStatus.ts  # NetInfo wrapper → { isOnline, type }
│   │   └── useEventTickets.ts   # SQLite query for event tickets
│   │
│   ├── components/
│   │   ├── ScanOverlay.tsx      # Camera overlay (corners, sweep line, flash layer)
│   │   ├── ScanResultSheet.tsx  # Bottom sheet (SUCCESS / ALREADY_SCANNED / INVALID)
│   │   ├── StatusPill.tsx       # Online/offline/syncing indicator
│   │   ├── EventCard.tsx        # Event list card (seeded status, ticket count)
│   │   ├── OfflineBanner.tsx    # Sticky banner when network is lost
│   │   └── DuplicateBanner.tsx  # Sticky amber banner when post-sync duplicate found
│   │
│   └── types/
│       ├── api.ts               # API response types (mirrors backend contracts)
│       ├── db.ts                # SQLite row types
│       └── scan.ts              # CheckinResult, ScanOutcome enum
│
├── app.json                     # Expo config with plugins
├── eas.json                     # EAS build profiles
├── tailwind.config.js           # NativeWind config
├── babel.config.js              # Reanimated + worklets plugins
└── tsconfig.json                # Strict mode, path aliases (@/ → src/)
```

---

## 5. Design System (Locked)

### Color Tokens (`src/constants/colors.ts`)

```ts
export const colors = {
  bg:         '#0D0D0D',   // Root background
  surface:    '#1C1C1E',   // Cards, sheets, inputs
  border:     '#2C2C2E',   // Dividers
  text:        '#FFFFFF',   // Primary text
  textMuted:  '#8E8E93',   // Secondary text
  success:    '#30D158',   // Green — valid scan
  error:      '#FF453A',   // Red — invalid scan
  warning:    '#FFD60A',   // Amber — duplicate scan
  info:        '#0A84FF',   // Blue — info states
  accent:     '#30D158',   // Primary action color
};
```

### Typography

- iOS: SF Pro (system font)
- Android: Roboto (system font)
- Use `font-system` NativeWind class

### Spacing

- Base unit: 4px
- Standard screen padding: 16px (p-4)
- Card padding: 16px

### Animations

| Trigger | Animation | Duration |
|---------|-----------|----------|
| QR scan result flash | Full-screen tint fade in → out | 300ms |
| Result sheet appear | Spring slide-up from bottom | spring(damping:15) |
| Result sheet SUCCESS auto-dismiss | Slide down | 1800ms delay |
| Scan line sweep | withRepeat(withTiming) top→bottom | 2000ms loop |
| Corner brackets on result | Scale + color flash | 200ms |
| Status pill change | Animated color transition | 250ms |
| Offline banner drop | Slide down from top | 300ms |

---

## 6. SQLite Schema (Canonical)

```sql
-- Migration version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

-- Events cached locally
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL,
  start_at    TEXT NOT NULL,
  end_at      TEXT NOT NULL,
  venue_name  TEXT NOT NULL,
  total_tickets   INTEGER NOT NULL DEFAULT 0,
  checked_in_count INTEGER NOT NULL DEFAULT 0,
  synced_at   TEXT,   -- ISO datetime of last full seed
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- All tickets for seeded events
CREATE TABLE IF NOT EXISTS tickets (
  id                TEXT PRIMARY KEY,
  event_id          TEXT NOT NULL,
  ticket_number     TEXT NOT NULL,
  ticket_type_name  TEXT NOT NULL,
  holder_name       TEXT,
  is_checked_in     INTEGER NOT NULL DEFAULT 0,   -- 0 | 1
  checked_in_at     TEXT,   -- ISO datetime
  checked_in_device TEXT,   -- deviceId that performed check-in
  FOREIGN KEY (event_id) REFERENCES events(id)
);
CREATE INDEX IF NOT EXISTS idx_tickets_event    ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_checked  ON tickets(event_id, is_checked_in);
CREATE INDEX IF NOT EXISTS idx_tickets_number   ON tickets(ticket_number);

-- Pending uploads (check-ins made locally but not yet synced to server)
CREATE TABLE IF NOT EXISTS scan_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  scanned_at  TEXT NOT NULL,   -- ISO datetime
  synced      INTEGER NOT NULL DEFAULT 0,   -- 0 = pending, 1 = synced
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_queue_pending ON scan_queue(event_id, synced);

-- Device registry (this device + known other devices for name display)
CREATE TABLE IF NOT EXISTS devices (
  device_id   TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  is_own      INTEGER NOT NULL DEFAULT 0,   -- 1 = this device
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 7. API Contract (Frontend Perspective)

All requests include: `Authorization: Bearer {accessToken}`
All requests timeout after 10 seconds.
On 401: auto-refresh access token, retry once. On second 401: logout.

### Types

```ts
// src/types/api.ts

export type ScannerEvent = {
  id: string;
  title: string;
  slug: string;
  startAt: string;
  endAt: string;
  venueName: string;
  totalTickets: number;
  checkedInCount: number;
};

export type ScannerTicket = {
  id: string;
  ticketNumber: string;
  ticketTypeName: string;
  holderName: string | null;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  checkedInDevice: string | null;
};

export type ScanOutcome = 'OK' | 'DUPLICATE' | 'NOT_FOUND';

export type BatchCheckinResult = {
  ticketId: string;
  outcome: ScanOutcome;
  checkedInAt?: string;
  firstScannedAt?: string;
  firstDeviceId?: string;
  firstDeviceName?: string;
};

export type CheckinResult = {
  outcome: 'SUCCESS' | 'ALREADY_SCANNED' | 'INVALID';
  ticket?: {
    ticketNumber: string;
    holderName: string | null;
    ticketTypeName: string;
    checkedInAt: string;
  };
  firstDeviceName?: string;
  firstCheckedInAt?: string;
};
```

---

## 8. Build Phases

### Phase 1 — Foundation: Auth, DB, Navigation
**Goal:** App boots, scanner logs in, tokens persist, SQLite initialised, auth gate works.

#### Files to Create

| File | What it does |
|------|-------------|
| `app.json` | Expo config — bundle ID, plugins, permissions |
| `eas.json` | EAS build profiles (development, preview, production) |
| `tailwind.config.js` | NativeWind v4 config with custom colors |
| `babel.config.js` | Expo preset + reanimated plugin + worklets plugin |
| `tsconfig.json` | Strict mode, `@/` path alias → `src/` |
| `src/constants/colors.ts` | Full color token map |
| `src/constants/config.ts` | `API_BASE_URL`, `POLL_INTERVAL_MS=5000`, `UPLOAD_INTERVAL_MS=10000`, `SEED_STALE_HOURS=4`, `MIN_PAYOUT_THRESHOLD=100` |
| `src/types/api.ts` | All API response types |
| `src/types/db.ts` | SQLite row types |
| `src/types/scan.ts` | `CheckinResult`, `ScanOutcome` |
| `src/db/client.ts` | `openDatabaseAsync('eventsbox.db')` singleton |
| `src/db/schema.ts` | All `CREATE TABLE` statements, `runMigrations()` |
| `src/db/tickets.ts` | `getTicket(id)`, `markCheckedIn(id, deviceId, at)`, `search(eventId, query)`, `getByEvent(eventId)` |
| `src/db/events.ts` | `upsertEvent(event)`, `getEvents()`, `getEvent(id)`, `updateCheckedInCount(id, count)` |
| `src/db/scan-queue.ts` | `enqueue(scan)`, `getPending(eventId)`, `markSynced(ids)`, `getPendingCount(eventId)` |
| `src/services/api.ts` | Typed `apiFetch(path, options)` with Bearer inject, 401 retry, 10s timeout |
| `src/services/auth.ts` | `login(email, password)`, `logout()`, `refreshToken()` |
| `src/store/auth.ts` | Zustand: `{ token, refreshToken, user, setAuth, clearAuth }` + SecureStore persistence |
| `app/_layout.tsx` | Root layout: `runMigrations()` on mount, hydrate auth from SecureStore, `<QueryClientProvider>` |
| `app/index.tsx` | Redirect: token → `/(app)/events`, no token → `/login` |
| `app/login.tsx` | Login screen with email/password, loading state, error display |
| `app/(app)/_layout.tsx` | Auth guard: no token → redirect `/login` |

#### Implementation Details

**`src/services/api.ts`:**
```ts
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // 1. Get token from auth store
  // 2. Set Authorization: Bearer header
  // 3. AbortController with 10s timeout
  // 4. fetch(API_BASE_URL + path, { ...options, signal })
  // 5. If 401: call refreshToken() → retry once
  // 6. If still 401: clearAuth(), throw new ApiError(401, 'SESSION_EXPIRED')
  // 7. If !res.ok: throw new ApiError(res.status, await res.json())
  // 8. Return res.json() as T
}
```

**`src/store/auth.ts`:**
```ts
// On app start: read tokens from SecureStore, verify not expired, hydrate store
// On setAuth: write tokens to SecureStore
// On clearAuth: delete from SecureStore, reset store
```

**`app/login.tsx`:**
- Dark bg `#0D0D0D`, EventsBox Scanner logo centered
- Email input (keyboardType="email-address", autoCapitalize="none")
- Password input (secureTextEntry)
- "Sign In" button (green `#30D158`)
- Error: "Invalid credentials" or "Network error — check your connection"
- On role mismatch: "This app is for scanner accounts only"
- On success: `router.replace('/(app)/events')`

#### Acceptance Criteria

- [ ] Scanner can log in with valid credentials
- [ ] Invalid credentials show error message
- [ ] Token persists across app kill and restart
- [ ] Non-SCANNER/ORGANIZER account shows "scanner accounts only" error
- [ ] SQLite is initialised on first launch (all tables exist)
- [ ] SQLite schema version is tracked and future migrations run automatically
- [ ] `npx expo start` runs without TypeScript errors

---

### Phase 2 — Event Selection + Pre-Sync Seed
**Goal:** Scanner sees today's events, downloads ticket data, seed stored in SQLite with progress.

#### Files to Create

| File | What it does |
|------|-------------|
| `src/services/pre-sync.ts` | `downloadTickets(eventId)` — cursor-paginated seed to SQLite |
| `src/hooks/useNetworkStatus.ts` | NetInfo wrapper → `{ isOnline, connectionType }` |
| `src/hooks/useEventTickets.ts` | SQLite query for all tickets for an event |
| `src/components/EventCard.tsx` | Card: title, date, venue, ticket count, seeded status badge, download button |
| `src/components/OfflineBanner.tsx` | Sticky top banner: "Offline — cached data shown" |
| `app/(app)/events/index.tsx` | Event list screen |
| `app/(app)/settings.tsx` | Basic settings (email, logout) |

#### Implementation Details

**`src/services/pre-sync.ts`:**
```ts
export async function downloadTickets(
  eventId: string,
  onProgress: (downloaded: number, total: number) => void
): Promise<void> {
  let cursor: string | undefined;
  let downloaded = 0;
  do {
    const res = await apiFetch<{ tickets, nextCursor, total }>(
      `/api/scanner/events/${eventId}/tickets?limit=500${cursor ? `&cursor=${cursor}` : ''}`
    );
    // Write batch to SQLite (tickets table)
    await db.runAsync('BEGIN TRANSACTION');
    for (const t of res.tickets) {
      await upsertTicket(t, eventId);
    }
    await db.runAsync('COMMIT');
    downloaded += res.tickets.length;
    onProgress(downloaded, res.total);
    cursor = res.nextCursor;
  } while (cursor);
  await updateEventSyncedAt(eventId);
}
```

**`app/(app)/events/index.tsx`:**
- Server state: `useQuery(['events'], () => apiFetch('/api/scanner/events?...'))`
- Local state: `getEvents()` from SQLite (shown immediately, stale-while-revalidate)
- Two sections: "Today" and "Upcoming" (grouped by date)
- Each event shows `EventCard`
- Pull-to-refresh → invalidate query
- Offline: show `OfflineBanner` + SQLite-cached events

**Seed flow:**
1. Tap event → check `event.synced_at`
2. If null or older than 4 hours → show seed modal with progress bar
3. `downloadTickets(eventId, onProgress)` fills progress bar
4. On complete → `router.push('/(app)/events/[eventId]/scan')`
5. If already seeded → navigate directly, trigger background refresh

#### Acceptance Criteria

- [ ] Events screen loads from SQLite immediately (< 100ms) then refreshes from API
- [ ] Events grouped into Today / Upcoming sections correctly
- [ ] Seed modal shows progress: "450 / 1200 tickets downloaded"
- [ ] Seeding 1200 tickets completes within 15 seconds on 4G
- [ ] Already-seeded event navigates directly to scan screen
- [ ] Offline: banner shown, cached events still visible
- [ ] Logout clears auth store + SecureStore + navigates to login

---

### Phase 3 — Core Scan Screen
**Goal:** Full-screen camera, 60fps QR decode, local check-in logic, result display with animations and haptics.

#### Files to Create

| File | What it does |
|------|-------------|
| `src/services/checkin.ts` | `performCheckin(ticketId, eventId, deviceId)` — SQLite read/write + queue enqueue |
| `src/hooks/useCheckin.ts` | Wraps checkin service, manages 3s debounce, exposes to scan screen |
| `src/components/ScanOverlay.tsx` | Camera overlay: animated corners, sweep line, flash layer |
| `src/components/ScanResultSheet.tsx` | Bottom sheet: SUCCESS / ALREADY_SCANNED / INVALID variants |
| `src/components/StatusPill.tsx` | Network + pending count + checked-in count indicator |
| `app/(app)/events/[eventId]/scan.tsx` | Main scan screen |

#### Implementation Details

**`src/services/checkin.ts`:**
```ts
export async function performCheckin(
  ticketId: string,
  eventId: string,
  deviceId: string
): Promise<CheckinResult> {
  const ticket = await getTicket(ticketId);

  if (!ticket) {
    return { outcome: 'INVALID' };
  }

  if (ticket.is_checked_in) {
    const deviceName = await getDeviceName(ticket.checked_in_device);
    return {
      outcome: 'ALREADY_SCANNED',
      ticket: { ...ticket },
      firstDeviceName: deviceName,
      firstCheckedInAt: ticket.checked_in_at,
    };
  }

  // BEGIN TRANSACTION — atomic write
  const now = new Date().toISOString();
  await db.runAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    // Double-check (prevent race condition between two concurrent scans)
    const fresh = await getTicket(ticketId);
    if (fresh?.is_checked_in) {
      await db.runAsync('ROLLBACK');
      return { outcome: 'ALREADY_SCANNED', ... };
    }
    await markCheckedIn(ticketId, deviceId, now);
    await enqueue({ ticketId, eventId, deviceId, scannedAt: now });
    await db.runAsync('COMMIT');
  } catch {
    await db.runAsync('ROLLBACK');
    throw err;
  }

  return { outcome: 'SUCCESS', ticket: { ...ticket, checkedInAt: now } };
}
```

**`src/components/ScanOverlay.tsx`:**
- Transparent full-screen overlay on top of camera
- 4 corner brackets (L-shapes) using `View` components or SVG
- Corner color changes on result: green/red/amber via Reanimated `useSharedValue`
- Sweep line: `Animated.View` with `withRepeat(withTiming(screenHeight, {duration: 2000}), -1)` — resets to top
- Flash layer: full-screen `View` with `backgroundColor` animated opacity (0 → 0.4 → 0)

**`src/components/ScanResultSheet.tsx`:**
```
SUCCESS:
  ✓ icon (green)
  "Ticket Valid"
  Holder name + ticket type
  Auto-dismiss after 1800ms

ALREADY_SCANNED:
  ⚠ icon (amber)
  "Already Scanned"
  "First scanned at [time] by [device name]"
  Manual dismiss button

INVALID:
  ✗ icon (red)
  "Invalid QR Code"
  "This QR code is not valid for this event"
  Auto-dismiss after 1500ms
```

**`app/(app)/events/[eventId]/scan.tsx`:**
- `useCameraDevice('back')` — back camera
- `useFrameProcessor` with `scanBarcodes([BarcodeType.QR])` — runs at 60fps on JS thread
- Debounce: `lastScannedId` ref + 3-second timeout
- On QR decode: `handleQR(value)` → `performCheckin()` → show result sheet + haptic
- Navigation tabs at bottom: Scan / List / Stats
- `StatusPill` top-right: shows "Online", "Offline (12 pending)", "Syncing..."

#### Acceptance Criteria

- [ ] QR codes decoded at 60fps with < 200ms decode-to-result latency
- [ ] Valid ticket: green flash + success sheet + `NotificationFeedbackType.Success` haptic
- [ ] Invalid QR: red flash + invalid sheet + `NotificationFeedbackType.Error` haptic
- [ ] Already-scanned ticket: amber flash + warning sheet showing time and device name
- [ ] Scan screen works completely offline after event is seeded
- [ ] Success sheet auto-dismisses in 1.8s, camera resumes immediately
- [ ] Already-scanned sheet requires manual dismiss
- [ ] Same QR within 3 seconds is debounced (ignored)
- [ ] Camera permission denied → graceful error with "Open Settings" link

---

### Phase 4 — Sync Engine
**Goal:** Scan queue drains to server. Pull sync receives other devices' scans. Conflicts detected and surfaced.

#### Files to Create

| File | What it does |
|------|-------------|
| `src/services/sync.ts` | `flush(eventId)`, `pullState(eventId, since)`, background task registration |
| `src/store/sync.ts` | Zustand: `status`, `pendingCount`, `lastSyncAt`, `duplicatesFound` |
| `src/hooks/useSync.ts` | Manages upload interval (10s) + pull interval (5s), triggers on reconnect |
| `src/components/DuplicateBanner.tsx` | Sticky amber banner on scan screen when post-sync duplicate found |

#### Implementation Details

**`src/services/sync.ts`:**

```ts
// UPLOAD SYNC — drain pending queue to server
export async function flush(eventId: string): Promise<void> {
  const pending = await getPending(eventId);
  if (pending.length === 0) return;

  setSyncStatus('syncing');
  try {
    const res = await apiFetch<{ results: BatchCheckinResult[] }>(
      '/api/scanner/batch-checkin',
      {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          scans: pending.map(s => ({
            ticketId: s.ticket_id,
            scannedAt: s.scanned_at,
            deviceId: s.device_id,
          })),
        }),
      }
    );

    for (const result of res.results) {
      if (result.outcome === 'DUPLICATE') {
        // Server says another device already scanned this ticket
        // Update local SQLite with the server's truth (first scan wins)
        await updateTicketFromServer(result);
        incrementDuplicateCount(); // Shows DuplicateBanner
      }
      // Mark queue item as synced regardless of outcome
    }
    await markSynced(pending.map(s => s.id));
    setSyncStatus('idle');
  } catch {
    setSyncStatus('error');
  }
}

// PULL SYNC — receive other devices' scans
export async function pullState(eventId: string, since: string): Promise<void> {
  const res = await apiFetch<{ scans, serverTime, totalCheckedIn }>(
    `/api/scanner/events/${eventId}/state?since=${encodeURIComponent(since)}`
  );

  for (const scan of res.scans) {
    const local = await getTicket(scan.ticketId);
    if (!local?.is_checked_in && scan.isCheckedIn) {
      // Another device scanned this ticket — update local DB
      await markCheckedIn(scan.ticketId, scan.checkedInDevice, scan.checkedInAt);
    }
  }

  await updateCheckedInCount(eventId, res.totalCheckedIn);
  setSyncLastAt(res.serverTime);
}
```

**Background sync (expo-background-fetch):**
```ts
TaskManager.defineTask('EVENTSBOX_BACKGROUND_SYNC', async () => {
  const activeEventId = getActiveEventId(); // from SecureStore
  if (!activeEventId) return BackgroundFetch.BackgroundFetchResult.NoData;
  const count = await getPendingCount(activeEventId);
  if (count > 0) {
    await flush(activeEventId);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  }
  return BackgroundFetch.BackgroundFetchResult.NoData;
});
BackgroundFetch.registerTaskAsync('EVENTSBOX_BACKGROUND_SYNC', {
  minimumInterval: 30,
  stopOnTerminate: false,
  startOnBoot: true,
});
```

**`src/hooks/useSync.ts`:**
- `useEffect`: on mount, start `setInterval(flush, 10_000)` and `setInterval(pullState, 5_000)`
- `useEffect`: subscribe to NetInfo → on reconnect → immediately call `flush()`
- Cleanup intervals on unmount

**Device registration:**
- On first login success: generate `deviceId = nanoid(21)`, store in SQLite `devices` table + SecureStore
- POST `/api/scanner/devices` — idempotent, safe to call every login
- The `deviceId` is passed in all `performCheckin` calls and in batch-checkin payloads

#### Acceptance Criteria

- [ ] Scans made while offline upload within 5 seconds of going online
- [ ] Other devices' scans appear in local SQLite within 5 seconds (poll cycle)
- [ ] DUPLICATE server response shows amber `DuplicateBanner` on scan screen
- [ ] Pending count in `StatusPill` updates live as queue drains
- [ ] Background sync drains queue when app is backgrounded (verify on device)
- [ ] Device is registered on first login, device name shown in conflict messages
- [ ] Network reconnect triggers immediate flush (not waiting for next interval)

---

### Phase 5 — Check-in List, Stats, Settings Polish, EAS Build
**Goal:** Full check-in list with search, event stats, complete settings, accessibility, EAS production build.

#### Files to Create

| File | What it does |
|------|-------------|
| `app/(app)/events/[eventId]/list.tsx` | Check-in list with FlashList, search, filter tabs |
| `app/(app)/events/[eventId]/stats.tsx` | Event stats: counts, chart, active devices |
| `app/(app)/settings.tsx` (full) | All settings: device name, server URL, poll interval, force sync, clear data |

#### Implementation Details

**`app/(app)/events/[eventId]/list.tsx`:**
- `FlashList` (from `@shopify/flash-list`) — handles 1200+ items at 60fps
- Search bar at top: `useDebounce(query, 200ms)` → `search(eventId, debouncedQuery)` in SQLite
- Filter tabs: All | Checked In | Not Checked In
- Each row:
  ```
  [●/○]  #TKT-001  John Smith
         General Admission    12:34 PM  [Device Name]
  ```
- Green dot = checked in, hollow = not checked in
- Pull-to-refresh → trigger `pullState(eventId, lastSyncAt)`
- Empty state: "No tickets match your search"

**`app/(app)/events/[eventId]/stats.tsx`:**
```
[Check-in Progress]
  847 / 1200 checked in
  [████████░░░░░░░░] 70.6%

[By Ticket Type]
  General Admission    650 / 900   (72%)
  VIP                  147 / 200   (74%)
  Student               50 / 100   (50%)

[Scan Activity (Last 2 Hours)]
  12:00–12:30  ████ 42
  12:30–13:00  ████████ 84
  13:00–13:30  ██████ 61
  13:30–14:00  ████ 38

[Active Devices]
  📱 iPhone 15 Pro Max (this device)  — 234 scans
  📱 Samsung Galaxy S24              — 613 scans
```
- All data from SQLite grouped queries — works offline
- Stats update live via Zustand subscription (when new scans come in via pull sync)

**`app/(app)/settings.tsx` (full):**
```
[Account]
  scanner@venue.com
  Organizer: EventsBox Concerts

[Device]
  Device Name: [iPhone 15 Pro Max]  [Save]
  Device ID:   cm_abc123xyz...      (readonly, copyable)

[Sync]
  Pull interval:  [3s / ●5s / 10s]
  Last synced:    2 minutes ago
  Pending scans:  0
  [Force Sync Now]

[Danger Zone]
  [Clear Local Data]  — confirm dialog, clears SQLite tickets + queue
  [Sign Out]

[About]
  Version 1.0.0 (build 42)
  Server: https://eventsbox.vercel.app
```
- Editing device name → PATCH `/api/scanner/devices/{deviceId}` on save
- Clear local data → `db.runAsync('DELETE FROM tickets')` + `DELETE FROM scan_queue WHERE synced=1`

#### EAS Build Setup

**`eas.json`:**
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your@apple.com", "ascAppId": "YOUR_APP_ID" },
      "android": { "serviceAccountKeyPath": "./google-service-account.json" }
    }
  }
}
```

#### Final QA Checklist

- [ ] Login → seed 1200 tickets → scan 10 → kill app → reopen → scan history preserved
- [ ] Go offline mid-event → scan 5 → go online → all 5 synced within 10s
- [ ] Two devices, same event, offline → scan same ticket on both → sync → DUPLICATE banner shown
- [ ] Camera permission denied → graceful error with "Open Settings" link
- [ ] Token expires mid-session → auto-refresh transparent to user
- [ ] Check-in list with 1200 entries scrolls at 60fps on low-end device
- [ ] Search returns results within 100ms
- [ ] Stats real-time update as scans arrive via pull sync
- [ ] Production APK < 50MB, IPA < 40MB
- [ ] Both iOS and Android pass EAS production build without errors
- [ ] VoiceOver (iOS) correctly reads all scan results and buttons

#### Acceptance Criteria

- [ ] FlashList renders 1200 rows at 60fps
- [ ] Search debounced to 200ms, returns within 100ms
- [ ] Stats update live via Zustand subscription
- [ ] EAS production build passes for both platforms
- [ ] App size within budget
- [ ] Accessibility minimum 44×44pt touch targets on all interactive elements

---

## 9. Codex Execution Order

Each phase has a separate Codex prompt. Run them in order. **Do not run the next phase until the current one passes its acceptance criteria.**

| Prompt File | Phase | Trigger |
|-------------|-------|---------|
| `docs/scanner-app/codex-phase1-prompt.md` | Foundation | Run first |
| `docs/scanner-app/codex-phase2-prompt.md` | Event Selection + Seed | After Phase 1 passes |
| `docs/scanner-app/codex-phase3-prompt.md` | Core Scan Screen | After Phase 2 passes |
| `docs/scanner-app/codex-phase4-prompt.md` | Sync Engine | After Phase 3 passes |
| `docs/scanner-app/codex-phase5-prompt.md` | Polish + EAS Build | After Phase 4 passes |

> Note: `codex-scanner-phase1-prompt.md` already exists in `docs/scanner-app/` — use it for Phase 1.

---

## 10. Environment Variables Required

The app reads one env variable baked in at build time via Expo's `extra` config:

```json
// app.json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "https://eventsbox.vercel.app"
    }
  }
}
```

For development, set `apiBaseUrl` to your local Vercel preview URL or `http://localhost:3000`.

No secrets in the app. All auth is handled via the login screen.

---

## 11. Known Constraints & Decisions

| Constraint | Decision |
|-----------|---------|
| Offline-first is non-negotiable | SQLite is the source of truth during scan; server confirms later |
| Dual-entry in offline mode | Unavoidable — DUPLICATE detected and flagged on reconnect |
| Two door scenario | Acceptable outcome: second device shows amber DUPLICATE banner after sync |
| iOS background limits | Background fetch minimum 30s; production scan events use foreground |
| No WebSocket | Short polling (5s pull) is sufficient for venue-scale usage |
| Frame processor threading | `runOnJS` used to bridge frame processor → React state |
| QR format | Encodes `QRTicket.id` (cuid) — same value backend uses for lookup |
| No PDF/pass integration | Out of scope for Phase 26 |
| Scanner app store account | Requires Apple Developer account ($99/year) and Google Play account ($25 one-time) |

---

## 12. Out of Scope (Do Not Add)

- Apple Wallet / Google Wallet passes
- Multi-organizer support in one scanner account
- In-app organizer event management
- Stripe payments
- Push notifications
- Offline map or directions
- Multi-language support
- Web version of scanner
- Manual ticket number entry (QR only)

---

## 13. Success Definition

Phase 26 is complete when:

1. A scanner account (`SCANNER` role) can log in on an iOS or Android device
2. They can see today's events and seed ticket data in under 15 seconds
3. They can scan QR codes from attendees' ticket wallets at 60fps
4. The app correctly shows SUCCESS / ALREADY_SCANNED / INVALID with no false positives
5. Two devices scanning the same ticket both offline → after reconnect, DUPLICATE is detected and shown
6. A production EAS build is submitted to both the App Store and Google Play
7. The app passes the full QA checklist above

When this is done, EventsBox is feature-complete.
