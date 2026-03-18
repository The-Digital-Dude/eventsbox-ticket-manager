# API Contract

All requests to the EventsBox backend API. Base URL from `src/constants/config.ts`.

## Authentication

All requests (except login) include:
```
Authorization: Bearer <accessToken>
```

On 401 response: auto-refresh using `POST /api/auth/refresh` with refresh token cookie.
If refresh fails: clear tokens, redirect to login.

---

## Auth

### Login
```
POST /api/auth/login
Body: { email: string, password: string }

Response 200:
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_xxx",
      "email": "scanner@events.com",
      "role": "SCANNER",
      "scannerOrganizerProfileId": "org_xxx"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}

Error 401: { "success": false, "error": { "code": "INVALID_CREDENTIALS" } }
Error 403: { "success": false, "error": { "code": "ROLE_NOT_ALLOWED" } }
  (if role is not SCANNER or ORGANIZER — app rejects ATTENDEE/ADMIN logins)
```

### Refresh Token
```
POST /api/auth/refresh
(Uses HTTP-only cookie OR Bearer refresh token header — match existing backend impl)

Response 200: { "data": { "accessToken": "eyJ..." } }
```

### Logout
```
POST /api/auth/logout
Response 200: { "success": true }
```

---

## Scanner — Events

### List events for this scanner
```
GET /api/scanner/events

Query params:
  ?from=ISO_DATE   default: today - 1 day
  ?to=ISO_DATE     default: today + 2 days

Response 200:
{
  "data": {
    "events": [
      {
        "id": "evt_xxx",
        "title": "Summer Music Fest",
        "slug": "summer-music-fest",
        "startAt": "2026-04-01T19:00:00Z",
        "endAt": "2026-04-01T23:00:00Z",
        "timezone": "Pacific/Auckland",
        "venueName": "Civic Arena",
        "totalTickets": 1200,
        "checkedInCount": 0
      }
    ]
  }
}

Auth: SCANNER (scoped to own org) or ORGANIZER (own org)
```

---

## Scanner — Tickets (Pre-Sync Seed)

### Download all tickets for an event
```
GET /api/scanner/events/{eventId}/tickets

Query params:
  ?cursor=string   pagination cursor (opaque)
  ?limit=500       max 500 per page

Response 200:
{
  "data": {
    "tickets": [
      {
        "id": "tkt_xxx",
        "ticketNumber": "T-0042",
        "ticketTypeName": "General Admission",
        "attendeeName": "John Smith",
        "isCheckedIn": false,
        "checkedInAt": null,
        "checkedInDevice": null
      }
    ],
    "nextCursor": "cursor_opaque_string_or_null",
    "total": 1200
  }
}

Auth: SCANNER (own org only) or ORGANIZER
```

---

## Scanner — Check-in

### Batch upload scans
```
POST /api/scanner/batch-checkin

Body:
{
  "eventId": "evt_xxx",
  "scans": [
    {
      "ticketId": "tkt_abc",
      "scannedAt": "2026-04-01T20:15:33.123Z",
      "deviceId": "device_uuid_string"
    }
  ]
}

Response 200:
{
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
        "firstScannedAt": "2026-04-01T20:14:55.000Z",
        "firstDeviceId": "other_device_uuid",
        "firstDeviceName": "iPhone 14"
      },
      {
        "ticketId": "tkt_zzz",
        "outcome": "NOT_FOUND"
      }
    ]
  }
}

Auth: SCANNER (own org only) or ORGANIZER
```

### Pull scan state since timestamp (real-time sync)
```
GET /api/scanner/events/{eventId}/state

Query params:
  ?since=ISO_DATE   only return scans after this timestamp

Response 200:
{
  "data": {
    "scans": [
      {
        "ticketId": "tkt_abc",
        "checkedInAt": "2026-04-01T20:15:29.000Z",
        "deviceId": "device_other_uuid",
        "deviceName": "iPhone 14"
      }
    ],
    "serverTime": "2026-04-01T20:15:40.000Z",
    "totalCheckedIn": 143
  }
}

Auth: SCANNER (own org only) or ORGANIZER
```

---

## Scanner — Device Registration

### Register device
```
POST /api/scanner/devices

Body:
{
  "deviceId": "uuid_string",
  "name": "iPhone 14"
}

Response 200: { "data": { "deviceId": "uuid_string", "name": "iPhone 14" } }
Response 200 (already exists): same, no error — idempotent

Auth: SCANNER or ORGANIZER
```

### Update device name
```
PATCH /api/scanner/devices/{deviceId}

Body: { "name": "Door 1 — Main Entrance" }
Response 200: { "data": { "deviceId": "...", "name": "Door 1 — Main Entrance" } }

Auth: SCANNER (own device only) or ORGANIZER
```

---

## Error Codes

| HTTP | code | Meaning |
|------|------|---------|
| 401 | UNAUTHENTICATED | Token missing or expired |
| 403 | FORBIDDEN | Wrong role or wrong org |
| 404 | EVENT_NOT_FOUND | Event doesn't exist |
| 404 | TICKET_NOT_FOUND | Ticket not in this event |
| 400 | VALIDATION_ERROR | Bad request body |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
