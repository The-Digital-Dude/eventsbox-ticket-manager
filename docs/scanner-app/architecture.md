# Architecture

## Tech Stack

| Layer | Technology | Version | Reason |
|---|---|---|---|
| Framework | Expo | SDK 52 | Managed workflow, OTA updates, EAS Build |
| Language | TypeScript | 5.x | Type safety across app + API contract |
| Navigation | Expo Router | v4 | File-based routing, native stack |
| Camera / QR | react-native-vision-camera | v4 | Fastest QR decode via frame processors (60fps) |
| QR Decode | vision-camera-code-scanner | latest | VisionCamera plugin, MLKit + ZXing |
| Local DB | expo-sqlite | v14 | SQLite — survives app kill, offline-first |
| Secure Storage | expo-secure-store | latest | JWT + refresh token storage |
| Network State | @react-native-community/netinfo | latest | Detect online/offline transitions |
| State | Zustand | v5 | Lightweight, persisted slices |
| Server State | @tanstack/react-query | v5 | Caching, background refetch, sync |
| Styling | NativeWind | v4 | Tailwind classes on React Native |
| Animations | react-native-reanimated | v3 | Scan flash, status transitions |
| Haptics | expo-haptics | latest | Success / error feedback |
| Background Sync | expo-task-manager + expo-background-fetch | latest | Sync scan queue when app is backgrounded |
| OTA Updates | expo-updates | latest | Push fixes without App Store review |
| Icons | @expo/vector-icons (Ionicons) | latest | Consistent icon set |
| Build | EAS Build | latest | Cloud native builds for iOS + Android |

## Directory Structure

```
EventsBox_Scanner_App/
├── app/                          # Expo Router — all screens
│   ├── _layout.tsx               # Root layout, auth gate, theme
│   ├── index.tsx                 # Redirect → /login or /events
│   ├── login.tsx                 # Login screen
│   ├── (app)/                    # Authenticated group
│   │   ├── _layout.tsx           # Auth guard + bottom tab shell
│   │   ├── events/
│   │   │   ├── index.tsx         # Event selector (today's events)
│   │   │   └── [eventId]/
│   │   │       ├── scan.tsx      # Active scan screen (full-screen camera)
│   │   │       ├── list.tsx      # Check-in list for this event
│   │   │       └── stats.tsx     # Event stats (count, % checked in)
│   │   └── settings.tsx          # Account, server URL, logout
├── src/
│   ├── db/
│   │   ├── client.ts             # SQLite connection singleton
│   │   ├── schema.ts             # CREATE TABLE statements + migrations
│   │   ├── tickets.ts            # Ticket queries (get, mark checked in)
│   │   ├── events.ts             # Event queries
│   │   └── scan-queue.ts         # Pending scan queue queries
│   ├── services/
│   │   ├── auth.ts               # Login, logout, token refresh
│   │   ├── sync.ts               # Full sync orchestrator
│   │   ├── pre-sync.ts           # Download all tickets for event
│   │   ├── checkin.ts            # Core check-in logic (offline-aware)
│   │   ├── poll.ts               # Short-poll for real-time scan events
│   │   └── api.ts                # Typed fetch wrapper with auth headers
│   ├── store/
│   │   ├── auth.ts               # Zustand: session, scanner profile
│   │   ├── scan.ts               # Zustand: active event, last scan result
│   │   └── sync.ts               # Zustand: sync status, queue count
│   ├── hooks/
│   │   ├── useCheckin.ts         # Perform check-in + queue + update
│   │   ├── useSync.ts            # Trigger sync, observe status
│   │   ├── useNetworkStatus.ts   # Online/offline boolean + type
│   │   └── useEventTickets.ts    # Ticket counts for active event
│   ├── components/
│   │   ├── ScanOverlay.tsx       # Camera viewfinder frame + scan line
│   │   ├── ScanResultSheet.tsx   # Bottom sheet result (valid/invalid/dup)
│   │   ├── StatusPill.tsx        # Online/offline/syncing indicator
│   │   ├── EventCard.tsx         # Card in event selector list
│   │   ├── TicketRow.tsx         # Row in check-in list
│   │   ├── StatBar.tsx           # "142 / 400 checked in" progress bar
│   │   └── ui/                   # Button, Input, Sheet, Badge, etc.
│   ├── constants/
│   │   ├── colors.ts             # Design system colors
│   │   └── config.ts             # API base URL, poll interval, etc.
│   └── types/
│       ├── api.ts                # API request/response types
│       ├── db.ts                 # SQLite row types
│       └── scan.ts               # ScanResult, CheckinOutcome types
├── docs/                         # All planning documents (this folder)
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
├── tailwind.config.js            # NativeWind config
├── tsconfig.json
└── package.json
```

## Data Flow

```
Camera Frame (60fps)
    │
    ▼ (VisionCamera frame processor — JS worklet)
QR Decode (MLKit)
    │ ticketId extracted
    ▼
useCheckin(ticketId)
    │
    ├─ Check SQLite: tickets table
    │       │
    │       ├─ NOT FOUND → result: INVALID
    │       ├─ FOUND, checked_in=1 → result: ALREADY_SCANNED (show time + device)
    │       └─ FOUND, checked_in=0 →
    │               │
    │               ├─ Write to scan_queue (pending)
    │               ├─ Update tickets.checked_in=1 locally
    │               └─ result: SUCCESS
    │
    ▼
ScanResultSheet (animated, auto-dismiss 2s)
    +
Haptic feedback (success / error)
    │
    ▼ (background)
Sync service (if online)
    ├─ POST /api/scanner/batch-checkin (drain scan_queue)
    ├─ Handle DUPLICATE responses → update local state
    └─ Mark scan_queue rows as synced
```

## State Architecture

```
Zustand (persisted to AsyncStorage)
├── authStore
│   ├── token: string | null
│   ├── refreshToken: string | null
│   └── scanner: { id, email, organizerProfileId, organizerName }
├── scanStore
│   ├── activeEventId: string | null
│   ├── lastResult: ScanResult | null
│   └── scanCount: number  (in-memory counter for this session)
└── syncStore
    ├── status: 'idle' | 'syncing' | 'error'
    ├── pendingCount: number
    ├── lastSyncAt: ISO string | null
    └── duplicatesFoundAfterSync: number
```

## Security

- JWT access token (short-lived) + refresh token stored in `expo-secure-store` (encrypted, backed by iOS Keychain / Android Keystore)
- All API requests: `Authorization: Bearer <token>`
- Token refresh runs automatically on 401 response
- Scanner accounts are scoped to one `organizerProfileId` — API enforces this server-side
- Device ID: `expo-application.getAndroidId()` / `expo-device` UUID — used for conflict attribution, not authentication
