---
id: STORY-02
epic: EPIC-12
title: Reconnect & lifecycle
status: done
---

## Goal

Keep the pipe usable across drops: explicit connect/disconnect and automatic
reconnect with capped backoff, surfaced as clear status transitions.

## Tasks

- [x] Auto-reconnect on unexpected close (capped exponential backoff); none after an
      explicit `close()`
- [x] Status transitions include `reconnecting`; expose the current status
- [x] Injectable timer/clock so backoff is unit-tested deterministically
- [x] Unit tests: drop → reconnecting → open; explicit close stops retries

## Acceptance

**Automated:** reconnect/backoff covered by Vitest (fake socket + fake timers).
**Manual (user):** killing/restarting the orchestrator reconnects without a reload.

## Notes

Backoff must respect the lock-step timing model later (C-01); this story only
restores the carrier, not the game loop (that pump is EPIC-14).
