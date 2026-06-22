---
id: STORY-01
epic: EPIC-19
title: Adaptive lock-step timeout
status: done
---

## Goal

Tune the per-tick read deadline for internet/mobile latency without breaking the lock-step
model (C-01). A fixed 1.5 s deadline either false-times-out the whole ring on a transient
latency spike (GC, WiFi/radio stall) or is slow to notice a dead peer; the original's
~0.4 s/byte assumed deterministic low-latency MIDI.

## Tasks

- [x] Centralize the scattered net timeouts into `net/timing.ts` (election, ring default,
      host setup, slave wait), documented and tied to the original.
- [x] `AdaptiveTimeout` (EWMA of measured tick RTT → deadline = `RTT × multiplier`, clamped
      to `[floor, ceiling]` = `[1500, 8000]`ms; ceiling before any sample). Pure + unit-tested.
- [x] `NetGame` uses it: `deadline()` per read, `update(lastTickMs)` after each exchange; a
      pinned `timeoutMs` still overrides (tests/debug). Exposes `lastTimeoutMs`.
- [x] `bandFromParams` URL overrides for venue tuning — `?tickTimeout=` (ceiling),
      `?tickFloor=` (floor); set equal to pin a fixed deadline. Unit-tested.
- [x] Overlay shows the live deadline: `ring rtt : <rtt>ms / <deadline>ms`, `NEAR LIMIT`
      past 66%.

## Acceptance

**Automated:** `AdaptiveTimeout` + `bandFromParams` unit-tested; build/lint green; the
networked golden/handshake tests still pass with the adaptive default.
**Manual (user):** on a real ring the deadline tracks measured RTT; a latency spike under
the band no longer kills the game; `?tickTimeout=`/`?tickFloor=` tune it at the venue.

## Notes

The lock-step model is unchanged — a byte that never arrives still ends the ring (timeout);
only the *duration* adapts. The RTT estimate reuses `lastTickMs` from EPIC-18.
