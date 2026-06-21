---
id: STORY-03
epic: EPIC-12
title: Room join (browser ?room= query param)
status: done
---

## Goal

Let a browser target a specific orchestrator room, as far as the browser platform
allows.

## Tasks

- [x] `Transport` accepts an optional room key and plumbs it toward the orchestrator
- [x] Default room when no key is given (keyless join)
- [x] Document the browser limitation and the chosen mechanism in code + story notes

## Acceptance

**Automated:** room-key plumbing (`buildUrl`) covered by Vitest.
**Verified (integration):** the real `Transport` (Node's built-in `WebSocket`, same
API as the browser) connecting `ws://…/?room=ALPHA` to a live `orchestrator.py --ws`
lands in ALPHA (online=1) and not the default room (online=0); a sent byte
round-trips (ring-of-one self-echo); killing the orchestrator drives `reconnecting`.

## Notes

**Resolved.** The original blocker was that the orchestrator read the room key only
from `Authorization: Bearer <key>`, which browsers cannot set on a `WebSocket`. The
orchestrator now **also accepts a browser-usable `?room=<key>` query param** (the
header still wins when both are present; empty → default room) — see
`orchestrator.py` `handle_ws` / `_query_param` and its `selftest.py` coverage. Our
`buildUrl` emits exactly that, so browsers can now join private rooms. Ties to
D-08 / D-14 and the EPIC-14 private-rooms work in the orchestrator repo.
