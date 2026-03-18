# Screen Designs & UX Flows

## Design System

### Colors
```ts
export const colors = {
  // Backgrounds
  bg:          '#0D0D0D',   // app background
  surface:     '#1C1C1E',   // cards, sheets
  surfaceHigh: '#2C2C2E',   // elevated surface
  border:      '#3A3A3C',   // dividers

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary:  '#636366',

  // Status
  success:  '#30D158',   // valid scan — Apple green
  error:    '#FF453A',   // invalid scan — Apple red
  warning:  '#FFD60A',   // duplicate / already scanned — Apple yellow
  info:     '#0A84FF',   // syncing, info — Apple blue

  // Scan overlay
  scanFrame:      'rgba(255,255,255,0.8)',
  scanLine:       '#30D158',
  scanFrameError: '#FF453A',
}
```

### Typography
```ts
// Uses system font stack
// SF Pro (iOS), Roboto (Android)
// Sizes: 12 / 14 / 16 / 20 / 24 / 32
// Weights: 400 (regular) / 500 (medium) / 600 (semibold) / 700 (bold)
```

### Spacing
```
Base unit: 4px (xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48)
Border radius: sm=8, md=12, lg=16, xl=24, full=9999
```

---

## Screen 1: Login

**Route:** `/login`

### Layout
```
┌─────────────────────────────┐
│                             │
│                             │
│         [E] EventsBox       │  ← Logo mark + wordmark, centered
│         Scanner             │
│                             │
│  ─────────────────────────  │
│                             │
│  [ Email address          ] │  ← Input, bg=#1C1C1E
│                             │
│  [ Password               ] │  ← Input with show/hide toggle
│                             │
│  [      Sign In           ] │  ← Full-width button, bg=#30D158, text black
│                             │
│  v1.0.0 • EventsBox        │  ← Footer, small grey
└─────────────────────────────┘
```

### Behaviour
- On submit: POST to `/api/auth/login` with `{ email, password }`
- Server validates role = SCANNER or ORGANIZER
- On success: store tokens in expo-secure-store, navigate to `/events`
- On error: shake animation on inputs, red error text below
- Keyboard: `returnKeyType="next"` on email, `returnKeyType="done"` on password
- No "Forgot password" — scanner accounts are managed by organizers

---

## Screen 2: Event Selector

**Route:** `/events`

### Layout
```
┌─────────────────────────────┐
│  EventsBox Scanner          │  ← Header
│                      [⚙]   │  ← Settings icon
├─────────────────────────────┤
│  TODAY                      │  ← Section header
│  ┌───────────────────────┐  │
│  │ 🟢 Summer Music Fest  │  │  ← EventCard (active = green dot)
│  │ 7:00 PM • Civic Arena │  │
│  │ 1,200 tickets         │  │
│  │ Seeded 5 min ago  [→] │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🔵 Tech Conference    │  │
│  │ 9:00 AM • Convention  │  │
│  │ 450 tickets           │  │
│  │ Not seeded yet    [↓] │  │  ← Download button
│  └───────────────────────┘  │
│                             │
│  UPCOMING (tomorrow)        │
│  ...                        │
└─────────────────────────────┘
```

### EventCard states
- **Seeded, not started:** grey dot, shows "Seeded X ago", tap → go to scan
- **Seeded, active (event today):** green dot, shows time, tap → go to scan
- **Not seeded:** blue download icon, tap → start seed download with progress
- **Seeding in progress:** progress bar inside card, "Downloading... 340/1200"

### Behaviour
- Loads from `GET /api/scanner/events` (cached, refreshes on focus)
- Events shown: today ± 2 days for this organizer
- Pull-to-refresh triggers re-fetch
- If offline and no cached events: show "No events cached. Connect to internet to load events."

---

## Screen 3: Active Scan (main screen)

**Route:** `/events/[eventId]/scan`

### Layout
```
┌─────────────────────────────┐
│ [←] Summer Music Fest       │   ← Back to events
│                             │
│  ┌──────────────────────┐  │
│  │ 🟢 ONLINE   142/400  │  │   ← StatusPill (online) + StatBar
│  └──────────────────────┘  │
│                             │
│  ┌─────────────────────────┐│
│  │ ░░░░░░░░░░░░░░░░░░░░░ ││   ← Camera viewfinder (full area)
│  │ ░░░░░░░░░░░░░░░░░░░░░ ││
│  │ ░░  ┌─────────────┐░░ ││   ← Scan frame (animated corners)
│  │ ░░  │             │░░ ││
│  │ ░░  │  ────────── │░░ ││   ← Scan line (sweeps up/down)
│  │ ░░  │             │░░ ││
│  │ ░░  └─────────────┘░░ ││
│  │ ░░░░░░░░░░░░░░░░░░░░░ ││
│  │ ░░░░░░░░░░░░░░░░░░░░░ ││
│  │    Point at QR code    ││   ← Hint text
│  └─────────────────────────┘│
│                             │
│  [≡ Check-in List]  [📊 Stats] │  ← Bottom nav pills
└─────────────────────────────┘
```

### Status Pill variants
```
🟢 ONLINE      — green dot, "ONLINE • 142/400 checked in"
🟡 SYNCING     — yellow spinner, "SYNCING • 3 pending"
🔴 OFFLINE     — red dot, "OFFLINE • 5 pending — DUAL ENTRY RISK"
```

The offline state shows a full-width amber banner below the pill:
```
┌────────────────────────────────┐
│  ⚠ OFFLINE — Syncing paused   │
│  5 scans pending upload        │
└────────────────────────────────┘
```

### Scan Frame Animation
- Four corner brackets (L-shapes) drawn with SVG/Canvas
- Animated scan line: `react-native-reanimated` `withRepeat(withTiming)` sweeping top to bottom
- On valid scan: frame briefly flashes **green** (200ms), scan line stops
- On invalid: frame flashes **red** (200ms)
- On duplicate: frame flashes **amber** (200ms)

### After Scan — Result Sheet
Bottom sheet slides up (350ms, spring animation):

**SUCCESS**
```
┌─────────────────────────────────┐
│          ✓                      │  ← Large green checkmark (lottie or reanimated)
│     VALID TICKET                │
│                                 │
│  John Smith                     │  ← Attendee name
│  General Admission              │  ← Ticket type
│  T-0042                         │  ← Ticket number
│                                 │
│  ─────────────────────────────  │
│  143 / 400 checked in  (35.7%) │
└─────────────────────────────────┘
```
Auto-dismisses after 1.8s, haptic: `.success` (iOS) / vibrate pattern (Android)

**ALREADY SCANNED**
```
┌─────────────────────────────────┐
│          ⚠                      │  ← Amber warning icon
│   ALREADY SCANNED               │
│                                 │
│  John Smith                     │
│  General Admission — T-0042     │
│                                 │
│  First scanned at 8:34 PM       │  ← Time
│  Door 1 — iPhone 14             │  ← Device name
│                                 │
│  [    Dismiss    ]              │  ← Manual dismiss (doesn't auto-dismiss)
└─────────────────────────────────┘
```
Haptic: `.warning` — does NOT auto-dismiss (requires staff attention)

**INVALID**
```
┌─────────────────────────────────┐
│          ✕                      │  ← Red X icon
│     INVALID TICKET              │
│                                 │
│  This QR code is not valid      │
│  for this event.                │
└─────────────────────────────────┘
```
Auto-dismisses after 1.5s, haptic: `.error`

---

## Screen 4: Check-in List

**Route:** `/events/[eventId]/list`

### Layout
```
┌─────────────────────────────┐
│ [←] Check-in List           │
│  [ Search by name/ticket# ] │
│  Filter: [All ▾] [Checked ▾]│
├─────────────────────────────┤
│ ✓  John Smith               │
│    General Admission • T-0042│
│    8:34 PM • This device    │
├─────────────────────────────┤
│ ✓  Sarah Johnson            │
│    VIP • T-0001             │
│    8:31 PM • Door 2         │  ← from another device
├─────────────────────────────┤
│ ○  Michael Brown            │
│    General Admission • T-0055│
│    Not checked in           │
└─────────────────────────────┘
```

### Behaviour
- Loaded from SQLite — fully offline-capable
- Search filters both checked-in and unchecked tickets by name and ticket number
- "This device" vs device name shown for scans from other devices
- Tap row → shows full ticket detail (name, type, check-in history)
- Pull to refresh → triggers pull sync from server

---

## Screen 5: Event Stats

**Route:** `/events/[eventId]/stats`

### Layout
```
┌─────────────────────────────┐
│ [←] Event Stats             │
│ Summer Music Fest            │
│ Tonight 7:00 PM             │
├─────────────────────────────┤
│  ┌──────────────────────┐   │
│  │    142               │   │  ← Large number
│  │ Checked in           │   │
│  │ ████████░░░░ 35.7%   │   │  ← Progress bar
│  │ of 400 total tickets │   │
│  └──────────────────────┘   │
│                             │
│  BY TICKET TYPE             │
│  General Admission  120/350 │  ← Mini bars
│  VIP                 18/40  │
│  Backstage            4/10  │
│                             │
│  SCAN ACTIVITY (last hour)  │
│  8PM ████ 40               │  ← Simple bar chart
│  9PM ██████████ 92         │
│  10PM ██ 10                │
│                             │
│  DEVICES ACTIVE             │
│  • This device      88 scans│
│  • iPhone 14 (Door 2) 54   │
└─────────────────────────────┘
```

---

## Screen 6: Settings

**Route:** `/settings`

### Layout
```
┌─────────────────────────────┐
│ Settings                    │
├─────────────────────────────┤
│ ACCOUNT                     │
│ scanner@events.com          │
│ Sunrise Events (organizer)  │
├─────────────────────────────┤
│ SYNC                        │
│ Last synced: 2 min ago       │
│ Pending: 0 scans            │
│ [  Force Sync Now  ]        │
├─────────────────────────────┤
│ DEVICE                      │
│ Device name: iPhone 14      │  ← Editable
│ Device ID: d8f3a...         │  ← Read-only, copyable
├─────────────────────────────┤
│ ADVANCED                    │
│ Server URL: api.eventsbox.co│  ← Editable for self-hosted
│ Poll interval: 5s           │
│ Clear local data            │  ← Dangerous, requires confirm
├─────────────────────────────┤
│ [ Log Out ]                 │  ← Red text button
│                             │
│ v1.0.0 (build 1)           │
└─────────────────────────────┘
```

---

## Navigation Flow

```
App Launch
    │
    ├─ No token → /login
    │
    └─ Token valid → /events
            │
            ├─ Tap event (seeded) → /events/[id]/scan   ← primary screen
            │        │
            │        ├─ [≡ List] → /events/[id]/list
            │        └─ [📊 Stats] → /events/[id]/stats
            │
            ├─ Tap event (not seeded) → trigger download, then /events/[id]/scan
            │
            └─ [⚙ Settings] → /settings
```

---

## Animations & Transitions

| Trigger | Animation |
|---------|-----------|
| Scan SUCCESS | Screen flash green (opacity 0→0.3→0, 300ms) + bottom sheet slide up |
| Scan INVALID | Screen flash red + haptic error |
| Scan DUPLICATE | Screen flash amber + haptic warning |
| Result sheet dismiss | Slide down (spring) |
| Status pill OFFLINE | Fade to red + banner drops down |
| Status pill ONLINE → after offline | Brief green pulse |
| Seed progress | Smooth width transition on progress bar |
| Event card tap | Scale 0.98 press state |
