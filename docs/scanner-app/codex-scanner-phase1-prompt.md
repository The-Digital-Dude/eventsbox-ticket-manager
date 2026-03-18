# Gemini Prompt — Scanner App Phase 1: Foundation

Run this from inside ~/Developer/TDD/EventsBox/EventsBox_Scanner_App/

---

You are building Phase 1 of the EventsBox Scanner App — a React Native + Expo SDK 52 mobile app for event ticket scanning.

Before writing any code, read these files from the EventsBox_Ticket_Manager repo (they are your specification):
- `../EventsBox_Ticket_Manager/docs/scanner-app/overview.md`
- `../EventsBox_Ticket_Manager/docs/scanner-app/architecture.md`
- `../EventsBox_Ticket_Manager/docs/scanner-app/api-contract.md`
- `../EventsBox_Ticket_Manager/docs/scanner-app/build-phases.md` (Phase 1 section only)

## Project Setup (do first if not done)

```bash
# If the project doesn't exist yet:
cd ~/Developer/TDD/EventsBox
npx create-expo-app@latest EventsBox_Scanner_App --template blank-typescript
cd EventsBox_Scanner_App

npx expo install expo-router expo-sqlite expo-secure-store expo-haptics \
  expo-updates expo-task-manager expo-background-fetch expo-application expo-device

npm install react-native-vision-camera vision-camera-code-scanner \
  react-native-worklets-core react-native-reanimated \
  nativewind tailwindcss \
  zustand @tanstack/react-query \
  @react-native-community/netinfo \
  nanoid

npm install --save-dev @types/react @types/react-native typescript
```

## Ground rules

- All files under `src/` use TypeScript strict mode
- Path alias: `@/` maps to `src/` (configure in tsconfig.json)
- Colors come from `src/constants/colors.ts` — never hardcode hex values
- No `console.log` left in production paths — use `console.warn` / `console.error` only
- Every async function that hits the DB or network has a try/catch

## Task 1.1 — Project configuration

Create/update these config files:

**tsconfig.json** — extend expo base, add path alias:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

**tailwind.config.js** — NativeWind v4:
```js
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0D0D0D",
        surface: "#1C1C1E",
        "surface-high": "#2C2C2E",
        border: "#3A3A3C",
        success: "#30D158",
        error: "#FF453A",
        warning: "#FFD60A",
        info: "#0A84FF",
      },
    },
  },
};
```

**babel.config.js** — add reanimated + NativeWind:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

**app.json** — add plugins:
```json
{
  "expo": {
    "name": "EventsBox Scanner",
    "slug": "eventsbox-scanner",
    "scheme": "eventsbox-scanner",
    "plugins": [
      ["expo-router", { "root": "app" }],
      [
        "react-native-vision-camera",
        { "cameraPermissionText": "EventsBox Scanner needs camera access to scan QR codes." }
      ],
      "expo-secure-store",
      "expo-background-fetch",
      "expo-task-manager"
    ]
  }
}
```

## Task 1.2 — Constants

**src/constants/colors.ts**:
```ts
export const colors = {
  bg: "#0D0D0D",
  surface: "#1C1C1E",
  surfaceHigh: "#2C2C2E",
  border: "#3A3A3C",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E8E93",
  textTertiary: "#636366",
  success: "#30D158",
  error: "#FF453A",
  warning: "#FFD60A",
  info: "#0A84FF",
  scanFrame: "rgba(255,255,255,0.8)",
  scanLine: "#30D158",
} as const;
```

**src/constants/config.ts**:
```ts
export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://api.eventsbox.com",
  pollIntervalMs: 5000,
  syncFlushIntervalMs: 10000,
  scanDebounceMs: 3000,
  ticketPageSize: 500,
  maxBatchSize: 500,
} as const;
```

## Task 1.3 — SQLite database

**src/db/client.ts** — singleton:
```ts
import * as SQLite from "expo-sqlite";
let _db: SQLite.SQLiteDatabase | null = null;
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) _db = await SQLite.openDatabaseAsync("eventsbox_scanner.db");
  return _db;
}
```

**src/db/schema.ts** — all CREATE TABLE + migration runner:
- `events` table: id, title, start_at, end_at, venue_name, total_tickets, synced_at, is_active
- `tickets` table: id, event_id, ticket_number, ticket_type_name, attendee_name, is_checked_in, checked_in_at, checked_in_device, sync_status
- `scan_queue` table: id, ticket_id, event_id, scanned_at, device_id, synced, outcome
- `devices` table: id, name, registered_at
- `schema_version` table: version

Indexes: `idx_tickets_event ON tickets(event_id)`, `idx_tickets_checkin ON tickets(event_id, is_checked_in)`, `idx_queue_synced ON scan_queue(synced)`

Migration runner: reads current version from schema_version, applies V1 if version < 1, inserts version=1.

**src/db/tickets.ts** — typed query functions:
```ts
export type DbTicket = {
  id: string; event_id: string; ticket_number: string;
  ticket_type_name: string | null; attendee_name: string | null;
  is_checked_in: 0 | 1; checked_in_at: string | null; checked_in_device: string | null;
  sync_status: "synced" | "local_pending";
};
export async function getTicket(ticketId: string, eventId: string): Promise<DbTicket | null>
export async function markCheckedIn(ticketId: string, deviceId: string): Promise<void>
export async function upsertTickets(tickets: DbTicket[]): Promise<void>
export async function getCheckedInCount(eventId: string): Promise<number>
export async function searchTickets(eventId: string, query: string): Promise<DbTicket[]>
export async function getTicketsByEvent(eventId: string): Promise<DbTicket[]>
```

**src/db/events.ts**:
```ts
export async function upsertEvent(event: DbEvent): Promise<void>
export async function getEvents(): Promise<DbEvent[]>
export async function getEvent(id: string): Promise<DbEvent | null>
export async function updateSyncedAt(id: string): Promise<void>
```

**src/db/scan-queue.ts**:
```ts
export async function enqueue(entry: { id: string; ticketId: string; eventId: string; scannedAt: string; deviceId: string }): Promise<void>
export async function getPending(eventId?: string): Promise<QueueEntry[]>
export async function markSynced(id: string, outcome: string): Promise<void>
export async function getPendingCount(): Promise<number>
```

## Task 1.4 — API service

**src/services/api.ts** — fetch wrapper:
- `apiRequest<T>(path: string, options?: RequestInit): Promise<T>`
- Reads base URL from config
- Injects `Authorization: Bearer <token>` from secure store
- On 401: calls `authService.refresh()` → retries once → if fails, clears auth + throws `AuthExpiredError`
- Throws `ApiError` (with `code` and `status`) on non-2xx
- 10 second timeout via `AbortController`

Types in `src/types/api.ts`:
```ts
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };
export class ApiError extends Error { constructor(public code: string, public status: number, message: string) }
export class AuthExpiredError extends Error {}
```

## Task 1.5 — Auth service + store

**src/services/auth.ts**:
```ts
export async function login(email: string, password: string): Promise<ScannerSession>
  // POST /api/auth/login
  // Validates role === 'SCANNER' || 'ORGANIZER' — throws if ATTENDEE or ADMIN
  // Stores accessToken + refreshToken in SecureStore
  // Returns ScannerSession

export async function logout(): Promise<void>
  // POST /api/auth/logout, clear SecureStore, clear Zustand

export async function refreshToken(): Promise<string>
  // POST /api/auth/refresh
  // Returns new accessToken, stores it
```

**src/store/auth.ts** — Zustand:
```ts
type ScannerSession = {
  id: string; email: string; role: "SCANNER" | "ORGANIZER";
  scannerOrganizerProfileId: string; organizerName: string;
};
type AuthStore = {
  session: ScannerSession | null;
  isHydrated: boolean;
  setSession: (s: ScannerSession) => void;
  clearSession: () => void;
  setHydrated: () => void;
};
```

SecureStore keys: `"eventsbox_access_token"`, `"eventsbox_refresh_token"`

## Task 1.6 — Root layout + navigation

**app/_layout.tsx**:
- Run DB migration on mount
- Hydrate auth from SecureStore
- Set up `QueryClient`
- Wrap with `QueryClientProvider` + `GestureHandlerRootView`
- Use dark StatusBar

**app/index.tsx**:
- If `!isHydrated`: show splash/loading screen
- If `session`: `router.replace("/(app)/events")`
- Else: `router.replace("/login")`

**app/(app)/_layout.tsx**:
- Check `authStore.session` — if null, `router.replace("/login")`
- Simple Stack navigator, dark background

## Task 1.7 — Login screen

**app/login.tsx** — full implementation:
- Dark background (#0D0D0D)
- Centered logo text "EventsBox / Scanner" (no image asset needed yet)
- Email input: `keyboardType="email-address"`, `autoCapitalize="none"`, `returnKeyType="next"`
- Password input: `secureTextEntry`, `returnKeyType="done"`, show/hide toggle
- Sign In button: bg-success (#30D158), black text, full width, rounded-xl
- Loading spinner replaces button text while submitting
- Error display below button: red text, shake animation using `react-native-reanimated`
- On success: `router.replace("/(app)/events")`
- Error message for wrong role: "This app is for scanner accounts only."

## After all tasks

Run:
```bash
npx expo start --dev-client
```

Verify:
- App launches, shows login screen with dark theme
- Login with valid SCANNER credentials → navigates to events (empty for now)
- Login with wrong credentials → error shown
- Kill app → reopen → still logged in (token persisted)
- Login with ATTENDEE account → "This app is for scanner accounts only." error

Output a list of every file created or modified.
