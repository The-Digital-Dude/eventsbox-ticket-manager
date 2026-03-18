# Build Phases

## Prerequisites (do once before any phase)

```bash
# Create the Expo project
cd ~/Developer/TDD/EventsBox
npx create-expo-app@latest EventsBox_Scanner_App --template blank-typescript
cd EventsBox_Scanner_App

# Install all dependencies up front
npx expo install expo-router expo-sqlite expo-secure-store expo-haptics \
  expo-updates expo-task-manager expo-background-fetch expo-application \
  expo-device expo-camera

npm install react-native-vision-camera vision-camera-code-scanner \
  react-native-worklets-core react-native-reanimated \
  nativewind tailwindcss \
  zustand @tanstack/react-query \
  @react-native-community/netinfo \
  nanoid

npm install --save-dev @types/react @types/react-native typescript

# Configure app.json (add plugins for vision-camera, reanimated, etc.)
# Configure tailwind.config.js for NativeWind
# Configure babel.config.js for reanimated + worklets
# Setup EAS project: eas init
```

**app.json plugins required:**
```json
{
  "plugins": [
    ["expo-router", { "root": "app" }],
    ["react-native-vision-camera", { "cameraPermissionText": "EventsBox Scanner needs camera access to scan QR codes." }],
    "expo-secure-store",
    "expo-background-fetch",
    ["expo-updates", { "username": "your-expo-username" }]
  ]
}
```

**eas.json:**
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {}
  }
}
```

Build a development client first:
```bash
eas build --profile development --platform all
# Install on device, then use it instead of Expo Go
```

---

## Phase 1 — Foundation: Auth, DB, Navigation

**Goal:** App boots, connects to API, scanner can log in, tokens persisted securely, SQLite initialised.

### Tasks

**1.1 Project setup**
- Configure Expo Router with file-based routing
- Set up NativeWind v4 (tailwind.config.js + babel plugin)
- Configure `src/constants/colors.ts` and `src/constants/config.ts`
- Set up TypeScript path aliases (`@/` → `src/`)

**1.2 SQLite database**
- Create `src/db/client.ts` — SQLite singleton using `expo-sqlite` `openDatabaseAsync`
- Create `src/db/schema.ts` — all CREATE TABLE statements + migration runner
- Create `src/db/tickets.ts` — query functions: `getTicket`, `markCheckedIn`, `getByEvent`, `search`
- Create `src/db/events.ts` — `upsertEvent`, `getEvents`, `getEvent`
- Create `src/db/scan-queue.ts` — `enqueue`, `getPending`, `markSynced`, `getCount`
- Run migration on app start in root `_layout.tsx`

**1.3 API service**
- Create `src/services/api.ts` — typed fetch wrapper:
  - Injects `Authorization: Bearer` header
  - Handles 401 → auto-refresh token → retry once
  - Throws typed `ApiError` on non-2xx
  - Timeout: 10 seconds

**1.4 Auth service + store**
- Create `src/services/auth.ts` — `login(email, password)`, `logout()`, `refreshToken()`
- Create `src/store/auth.ts` — Zustand store: `{ token, refreshToken, scanner, setAuth, clearAuth }`
- Persist token to `expo-secure-store` (not AsyncStorage — more secure)
- Token hydration on app launch in root `_layout.tsx`

**1.5 Navigation + auth gate**
- `app/_layout.tsx` — root: initialise DB, hydrate auth, set up QueryClient
- `app/index.tsx` — redirect to `/login` or `/events` based on auth state
- `app/login.tsx` — login screen (full implementation)
- `app/(app)/_layout.tsx` — auth guard: if no token redirect to `/login`

**1.6 Login screen**
- Email + password inputs with validation
- Loading state on submit
- Error display (invalid credentials, network error)
- On success: `router.replace('/(app)/events')`

**Acceptance criteria:**
- Scanner can log in with valid credentials
- Invalid credentials show error
- Token is persisted across app kill/restart
- Non-SCANNER/ORGANIZER role login shows error: "This app is for scanner accounts only"
- SQLite is initialised with correct schema on first launch

---

## Phase 2 — Event Selection + Pre-Sync Seed

**Goal:** Scanner sees today's events, can download ticket data, seed stored in SQLite.

### Tasks

**2.1 Events API + screen**
- Create `src/services/pre-sync.ts` — `downloadTickets(eventId)` with cursor pagination
- Create `app/(app)/events/index.tsx` — event list screen
- Create `src/components/EventCard.tsx` — card with seed status, progress bar
- Implement pull-to-refresh
- Show events from SQLite (if cached) + background refresh from API

**2.2 Seed download flow**
- Tap unseeded event → show download progress modal
- `downloadTickets` loops cursor pages, writes to SQLite in batches of 500
- Progress: `{ downloaded: 450, total: 1200 }`
- On complete: update `events.synced_at`, navigate to scan screen
- If already seeded: navigate directly to scan screen, trigger background refresh

**2.3 Network awareness**
- Create `src/hooks/useNetworkStatus.ts` — wraps NetInfo, returns `{ isOnline, type }`
- Show offline banner in event list: "Offline — showing cached events only"

**2.4 Settings screen (basic)**
- `app/(app)/settings.tsx` — email, organizer name, logout
- Logout: clear secure store + Zustand + SQLite (optional: keep tickets for offline), navigate to login

**Acceptance criteria:**
- Events load and display correctly
- Tapping "Download" on an unseeded event shows progress and completes
- With 1200 tickets, seed completes within 15 seconds on 4G
- Offline: shows cached events with age warning

---

## Phase 3 — Core Scan Screen

**Goal:** Full-screen camera, QR decode, local check-in logic, result display with animations.

### Tasks

**3.1 Camera + frame processor**
- `app/(app)/events/[eventId]/scan.tsx` — main scan screen
- Request camera permission on screen mount
- Set up `react-native-vision-camera` `<Camera>` component, `isActive` tied to screen focus
- Set up `useCameraDevice('back')`
- Add frame processor using `vision-camera-code-scanner` to decode QR codes
- Debounce: ignore same ticketId scanned within 3 seconds

**3.2 Check-in logic**
- Create `src/services/checkin.ts` — `performCheckin(ticketId, eventId, deviceId): CheckinResult`
  - Queries SQLite
  - Writes to scan_queue + updates tickets
  - Returns `{ outcome, ticket, checkedInAt, firstDeviceName? }`
- Create `src/hooks/useCheckin.ts` — wraps service, exposes to scan screen

**3.3 Scan overlay**
- Create `src/components/ScanOverlay.tsx`
  - Animated corner brackets (SVG or View-based)
  - Sweeping scan line using `react-native-reanimated` `withRepeat`
  - Flash layer (full-screen tint) that flashes green/red/amber on result

**3.4 Result bottom sheet**
- Create `src/components/ScanResultSheet.tsx`
  - Three variants: SUCCESS, ALREADY_SCANNED, INVALID
  - Slides up from bottom using `react-native-reanimated` / Expo's `BottomSheet`
  - SUCCESS: auto-dismiss after 1.8s
  - ALREADY_SCANNED: manual dismiss, shows device name + time
  - INVALID: auto-dismiss after 1.5s

**3.5 Haptics**
- SUCCESS → `Haptics.notificationAsync(NotificationFeedbackType.Success)`
- INVALID → `Haptics.notificationAsync(NotificationFeedbackType.Error)`
- ALREADY_SCANNED → `Haptics.notificationAsync(NotificationFeedbackType.Warning)`

**3.6 Status pill**
- Create `src/components/StatusPill.tsx`
  - Shows: network status + pending scan count + checked-in count
  - Offline mode: amber pill + warning banner

**Acceptance criteria:**
- QR codes scanned at 60fps with < 200ms decode-to-result latency
- Valid ticket: green flash + success sheet + haptic
- Invalid QR: red flash + invalid sheet + haptic
- Already-scanned ticket: amber flash + warning sheet with time + device name
- Scan screen works completely offline after event is seeded
- Result sheet does not block repeated scanning (dismisses quickly)
- Same QR code scanned twice within 3s is ignored (debounce)

---

## Phase 4 — Sync Engine

**Goal:** Scan queue uploads to server. Pull sync receives other devices' scans. Conflict detection.

### Tasks

**4.1 Upload sync**
- Create `src/services/sync.ts` — main sync orchestrator
  - `flush(eventId)` — drain scan_queue for event, POST to `/api/scanner/batch-checkin`
  - Handle DUPLICATE results: update local SQLite, increment duplicate counter
  - Mark queue rows as synced
- Trigger `flush` after every successful scan (non-blocking, background)
- Trigger `flush` on NetInfo reconnect event
- Trigger `flush` every 10 seconds via `setInterval` when active

**4.2 Pull sync**
- Add `pullState(eventId, since)` to `sync.ts`
  - GET `/api/scanner/events/{eventId}/state?since=...`
  - For each scan received: update local SQLite if not already locally scanned
  - Update `syncStore.lastSyncAt`
- Run every 5 seconds when online + active event selected

**4.3 Sync store**
- Create `src/store/sync.ts` — `{ status, pendingCount, lastSyncAt, duplicatesFoundAfterSync }`
- Duplicate banner: when `duplicatesFoundAfterSync > 0`, show sticky banner on scan screen: "⚠ X duplicate entry detected after sync — tap to review"

**4.4 Background sync**
- Register `expo-background-fetch` task
- On background fetch: drain scan_queue if items pending
- iOS: minimum 30s interval. Android: WorkManager-based.

**4.5 Device registration**
- On first launch: generate `deviceId` (`nanoid(21)`), store in SQLite `devices` table + expo-secure-store
- POST to `/api/scanner/devices` with `{ deviceId, name: expo-device.deviceName }`
- Idempotent endpoint — safe to call on every login

**Acceptance criteria:**
- Scans made while offline are uploaded within 5 seconds of going online
- Scans from other devices appear in local SQLite within 5 seconds when online
- DUPLICATE response shows amber banner on scan screen
- Pending scan count in StatusPill updates in real-time
- Background sync drains queue when app is backgrounded

---

## Phase 5 — Check-in List + Stats + Polish

**Goal:** Full check-in list, event stats screen, settings polish, EAS build, final QA.

### Tasks

**5.1 Check-in list screen**
- `app/(app)/events/[eventId]/list.tsx`
- Virtual list (FlashList from Shopify for performance — `@shopify/flash-list`)
- Search bar filters SQLite by name + ticket number (debounced 200ms)
- Filter: All / Checked In / Not Checked In
- Each row: ticket number, name, type, checked-in time, device indicator
- Loaded from SQLite — works fully offline
- Pull-to-refresh → triggers pull sync

**5.2 Stats screen**
- `app/(app)/events/[eventId]/stats.tsx`
- Overall check-in count + percentage + progress bar
- Breakdown by ticket type (from SQLite grouped query)
- Scan activity last 2 hours (30-min buckets, simple bar chart using CSS-width divs)
- Active devices list

**5.3 Settings screen (full)**
- Device name (editable, syncs to server on save)
- Server URL (for self-hosted users)
- Poll interval selector (3s / 5s / 10s)
- Force sync button
- Clear local data (confirm dialog)
- App version + build number

**5.4 Error states**
- Network timeout toast
- Server error toast
- Seed failure with retry button
- Expired token → auto-logout with message

**5.5 Accessibility**
- VoiceOver / TalkBack labels on all interactive elements
- Minimum touch target 44×44pt
- High contrast mode: check colors meet WCAG AA

**5.6 EAS Build configuration**
- `eas.json`: development + preview + production profiles
- iOS: configure bundle ID, provisioning profile
- Android: configure package name, keystore
- Test production build on real devices

**5.7 Final QA checklist**
- [ ] Login → scan → 200 tickets → check-in 10 → kill app → reopen → scan history preserved
- [ ] Go offline mid-event → scan 5 tickets → go online → all 5 synced within 10s
- [ ] Two devices, same event, offline → scan same ticket on both → sync → duplicate banner shown
- [ ] Camera permission denied → graceful error with settings link
- [ ] Token expires mid-session → auto-refreshes transparently
- [ ] Low battery background sync → verify scans uploaded before app killed

**Acceptance criteria:**
- Check-in list with 1200 entries scrolls at 60fps (FlashList)
- Search returns results within 100ms (SQLite FTS or LIKE query)
- Stats update in real-time as scans happen (Zustand subscription)
- Production build size: < 50MB (Android APK), < 40MB (iOS IPA)
- Passes EAS build for both platforms without warnings

---

## Build Commands Reference

```bash
# Development (on device with dev client)
npx expo start --dev-client

# EAS builds
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android

# OTA update (no store review needed)
eas update --branch production --message "Fix sync bug"
```
