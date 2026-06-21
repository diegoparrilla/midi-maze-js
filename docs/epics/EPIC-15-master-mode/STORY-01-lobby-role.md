---
id: STORY-01
epic: EPIC-15
title: Lobby role & connection
status: done
---

## Goal

Let the player pick how to play — **Solo**, **Host**, or **Join** — and where to
connect, from the GEM lobby. Solo keeps the existing offline path; Host/Join carry a
`NetConfig` into the networking stack.

## Tasks

- [x] `NetConfig` model: `mode` (`solo` | `host` | `join`), `url` (orchestrator WS),
      `room` (optional key); sensible defaults; basic validation. Unit-tested.
- [x] GEM lobby control to select the mode; server URL + room fields shown only for
      Host/Join (a Join needs only name + connection — the host's config wins)
- [x] Persist the connection fields within the session

## Acceptance

**Automated:** `NetConfig` defaults/validation covered by Vitest; build/lint green.
**Manual (user):** the lobby offers Solo/Host/Join and accepts a server URL + room.

## Notes

The room maps to the orchestrator `?room=` (EPIC-12 / D-14). Default URL is the dev
server's LAN orchestrator; wire mechanics live in STORY-02/03.
