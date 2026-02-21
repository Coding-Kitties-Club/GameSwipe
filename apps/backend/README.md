# GameSwipe Backend (apps/backend)

Express + TypeScript backend for GameSwipe (room-based multiplayer game picker).

This README documents the currently implemented endpoints:

- Health
- Create room
- Join room
- Get room state
- Delete room
- Link Steam Identity
- Get Steam Identity
- Sync Steam Owned Games

## Run locally

### Prerequisites

- Node.js
- A Postgres database (e.g. Supabase)

### Environment variables

These are read from the repo root `.env` (recommended):

```env
PORT=4000

DATABASE_URL=postgresql://...
SESSION_SECRET=...at least 16 chars...

SESSION_COOKIE_NAME=gs_session
SESSION_TTL_DAYS=30

STEAM_WEB_API_KEY=your_steam_web_api_key
```

## Start dev server

Run from GameSwipe repo root

```BASH
npm --workspace apps/backend run dev
```

Server listens on:

- <http://localhost:${PORT}>

## Common API behavior

### Content-Type

All JSON endpoints use:

- Content-Type: application/json

### Session auth (cookie)

Authenticated endpoints require a session cookie:

- Cookie name: SESSION_COOKIE_NAME (default gs_session)

- Cookie is set on successful room create/join.

### Error response format

On errors, responses follow:

```JSON
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": null
  }
}
```

Common status codes:

- 400 validation errors (e.g. invalid JSON shape)

- 401 unauthenticated (missing/invalid/expired session)

- 403 authenticated but forbidden (not a room member, not creator)

- 404 not found (room does not exist / code not found)

- 410 gone (room deleted or expired)

- 500 unexpected server error

## Endpoints

### GET `/health`

Simple health check.

**Response `200`**

```JSON
{
  "ok": true,
  "service": "gameswipe-backend",
  "time": "2026-02-20T12:59:55.000Z"
}
```

---

## Rooms

Used to create and manage the rooms system.

### POST /rooms

Create a new room and a creator member. Sets a session cookie.

```JSON
Request body
{
  "expiresInHours": 24
}
```

- `expiresInHours` optional
- default `24`
- max `168` (7 days)

#### Response `201`

```JSON
{
  "room": {
    "id": "uuid",
    "code": "ABC123",
    "expiresAt": "2026-02-21T12:00:00.000Z"
  },
  "member": {
    "id": "uuid",
    "role": "creator"
  }
}
```

#### Errors

- `500 INTERNAL_ERROR` if room code allocation fails (extremely unlikely, but handled)

### POST /rooms/join

Join an existing room by code. Creates a member and sets a session cookie.

```JSON
Request body
{
  "code": "ABC123",
  "displayName": "Ryan"
}
```

- `code` is case-insensitive
- `displayName` optional

#### Response `200`

```JSON
{
  "room": {
    "id": "uuid",
    "code": "ABC123",
    "expiresAt": "2026-02-21T12:00:00.000Z"
  },
  "member": {
    "id": "uuid",
    "role": "member",
    "displayName": "Ryan"
  },
  "session": {
    "token": "raw-session-token"
  }
}
```

> Note: A cookie is set even though the token is also returned in JSON.

**Errors.**

- `404 ROOM_NOT_FOUND`if code doesn’t exist
- `410 ROOM_GONE` if room was deleted or expired

### GET /rooms/:roomId

Get the current room state (room metadata + members list).

**Auth required:** session cookie.

#### URL params

- `roomId`: UUID

#### Response `200`

```JSON
{
  "room": {
    "id": "uuid",
    "code": "ABC123",
    "createdAt": "2026-02-20T12:00:00.000Z",
    "expiresAt": "2026-02-21T12:00:00.000Z"
  },
  "me": {
    "memberId": "uuid",
    "role": "creator"
  },
  "members": [
    {
      "id": "uuid",
      "role": "creator",
      "displayName": null,
      "joinedAt": "2026-02-20T12:00:00.000Z",
      "lastSeenAt": "2026-02-20T12:05:00.000Z"
    },
    {
      "id": "uuid",
      "role": "member",
      "displayName": "Ryan",
      "joinedAt": "2026-02-20T12:02:00.000Z",
      "lastSeenAt": "2026-02-20T12:06:00.000Z"
    }
  ]
}
```

The endpoint also updates the requester’s last_seen_at (best-effort presence tracking).

#### Errors

- `401 UNAUTHORISED` if missing/invalid/expired session
- `403 FORBIDDEN` if authenticated but not a member of the room
- `404 ROOM_NOT_FOUND` if roomId doesn’t exist
- `410 ROOM_GONE` if room deleted or expired

### DELETE /rooms/:roomId

Delete a room early.

**Auth required:** session cookie.
**Authorization:** only the creator can delete.

#### URL params

- `roomId`: UUID

#### Response `204`

No content.

#### Behavior notes

Room is marked deleted (soft delete).

Member sessions in the room are revoked.

#### Errors

- `401 UNAUTHORISED` if missing/invalid/expired session
- `403 FORBIDDEN` if not a member, or not creator
- `404 ROOM_NOT_FOUND` if roomId doesn’t exist
- `410 ROOM_GONE` if already deleted

---

## Steam Integration

Steam identity linking and owned-games syncing are supported.

All Steam endpoints require an authenticated session cookie.

---

### PUT /steam/identity

Link or update a Steam account (manual provider).

- Validates `steamid64` format (17-digit string).
- Verifies that the Steam account exists using the Steam Web API.
- Does NOT prove ownership (OpenID will handle that in future).

#### Request body

```JSON
{
  "steamid64": "76561198000000000"
}
```

#### Response `200`

```JSON
{
  "steamid64": "76561198000000000",
  "verified": false,
  "provider": "manual"
}
```

#### Errors

- `400 INVALID_REQUEST` invalid steamid format
- `401 UNAUTHORISED` missing/invalid session
- `404 STEAM_ACCOUNT_NOT_FOUND` Steam account does not exist
- `502 STEAM_UPSTREAM_ERROR` Steam API failure

### GET /steam/identity

Return the linked Steam identity for the current member.

#### Response `200`

```JSON
{
  "steamid64": "76561198000000000",
  "verified": false,
  "provider": "manual"
}
```

#### Errors

- `401 UNAUTHORISED` missing/invalid session
- `404 STEAM_IDENTITY_NOT_FOUND` Steam account does not exist

### POST /steam/library/sync

Fetch and cache the user’s owned Steam games.

- Uses `IPlayerService/GetOwnedGames`.
- Caches results in `steam_owned_games`.

#### Response `200`

```JSON
{
  "steamid64": "76561198000000000",
  "gameCount": 123,
  "fetchedAt": "2026-02-21T15:10:00.000Z"
}
```

#### Errors

- `401 UNAUTHORISED`
- `404 STEAM_IDENTITY_NOT_FOUND`
- `403 STEAM_GAMES_NOT_VISIBLE` if owned games are not publicly visible
- `502 STEAM_UPSTREAM_ERROR` if Steam API fails

---
