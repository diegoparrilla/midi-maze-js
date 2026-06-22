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
against the live orchestrator, Rooms lists the active rooms and selecting one joins it.

## Notes

Best-effort by design: an orchestrator without `/rooms` (or a CORS-restricting proxy) just
yields "rooms unavailable (using default room is fine)" — the keyed/default join path is
unchanged. Closes EPIC-23.
