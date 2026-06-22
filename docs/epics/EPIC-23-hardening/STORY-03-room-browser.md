---
id: STORY-03
epic: EPIC-23
title: Room browser (GET /rooms)
status: done
---

## Goal

Let a player pick a room from a list instead of typing the key. The orchestrator exposes
`GET /rooms` (open) with a per-room summary (ORCHESTRATOR-CONTRACT); rooms already work via
`?room=`, this is the discovery UX.

## Tasks

- [x] `net/rooms.ts`: `roomsEndpoint` (ws→http / wss→https, path `/rooms`, query dropped),
      `parseRooms` (tolerant of a bare array or `{rooms:[]}`, aliased/missing fields),
      `fetchRooms` (best-effort — null on missing endpoint / CORS / non-ok). Pure parts
      unit-tested with a fake `fetch`.
- [x] Connect screen: a **Rooms** button lists active rooms (name · player count · phase);
      clicking a row fills the Room field. Graceful empty/unavailable messages.

## Acceptance

**Automated:** `roomsEndpoint` / `parseRooms` / `fetchRooms` unit-tested (URL mapping,
envelope + alias tolerance, fetch failure → null); build/lint green. **Manual (user):**
against the live orchestrator, Rooms lists the active rooms and selecting one joins it —
**requires CORS on the orchestrator** (see Notes).

## Notes

The `/rooms` fetch is **cross-origin** (browser page → orchestrator host), so the
orchestrator must send `Access-Control-Allow-Origin` on its HTTP responses — added to
`md-MIDI2IP` `orchestrator.py` `_http_send` (`*`, safe: open read-only endpoints; writes
still need the admin key). Without it the browser blocks the fetch and the screen shows
"rooms unavailable (orchestrator CORS?)"; the keyed/default join path is unaffected.
Closes EPIC-23.
