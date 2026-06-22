---
id: STORY-02
epic: EPIC-18
title: ST-bridge timing/pacing review
status: done
---

## Goal

De-risk the real Atari ST bridge bring-up (the untested path; Hatari already works). Two
ST-specific hazards that Hatari's instant, generously-buffered MIDI hides:

1. **Bulk-send burst.** The `SEND_DATA` block is **4123 bytes** (4096-byte maze + config +
   seed). The windowed-echo (`sendPaced`) puts `sendWindow` bytes on the wire *before* the
   first echo returns, so the window must not exceed the receiver's input buffer. A real
   ST's ACIA has **no receive FIFO**; the sidecartridge bridge's buffer depth is unknown,
   so `sendWindow = 50` (fine on Hatari) may overflow the bridge and stall the handshake.
2. **Lock-step headroom.** A real ring (browser → orchestrator → bridge → ST → back, ×N)
   has real latency; if a tick's exchange approaches `TICK_TIMEOUT_MS` (1500 ms) the game
   false-times-out (C-01). At 3125 B/s the original tolerates ~0.4 s/byte; the browser is
   already more tolerant, but the over-internet path needs measuring, not assuming.

## Tasks

- [x] Make the windowed-echo burst tunable: `setSendWindow` / `getSendWindow` (default 50,
      clamped 1..512) in `net/setup.ts`, and a `?sendWindow=N` URL override in `main.ts` so
      the bridge window can be dropped at the venue without a rebuild. Unit-tested.
- [x] Measure the per-tick ring exchange (`NetGame.lastTickMs`) and surface it in the D-key
      interop overlay as `ring rtt : <ms> / <TICK_TIMEOUT_MS>ms`, flagging `NEAR LIMIT` past
      66% so a tightening real ring is visible before it times out.
- [x] Show the active `send window` in the overlay too (confirms a `?sendWindow=` override).

## Acceptance

**Automated:** the send-window setter (default/clamp/cap/floor) is unit-tested; build/lint
green. **Manual (user):** on the real ST bridge, if the handshake stalls mid-block, lower
`?sendWindow=` (e.g. 16, 8) until it completes; watch `ring rtt` during play and raise
`TICK_TIMEOUT_MS` only if real ticks approach the limit.

## Notes

The right values are empirical — this story gives the knobs and the gauge; the verdict
comes from the user's hardware. The steady-state joystick loop already sends one byte per
node per tick (never bursts), so only `SEND_DATA` needs pacing.
