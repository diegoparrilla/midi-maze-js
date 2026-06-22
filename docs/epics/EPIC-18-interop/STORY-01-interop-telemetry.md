---
id: STORY-01
epic: EPIC-18
title: Live interop telemetry overlay
status: done
---

## Goal

Make a mixed-ring desync **visible and localizable** while bringing up the real Atari ST
bridge (sidecartridge multidevice) against the browser. The Hatari gateway ↔ browser path
already works live; the real-ST-bridge path is the untested one, and a real MIDI port's
hard 31250-baud pacing + lock-step timeouts (C-01) are the likely failure points. Extend
the existing D-key debug overlay with per-tick interop diagnostics so a divergence can be
caught the instant it appears and pinned to a tick.

## Tasks

- [x] World checksum (`sim/checksum.ts`): a pure FNV-1a signature over every player/drone's
      per-tick integer state. Every node steps the identical joystick table, so all nodes
      must hold the identical checksum each tick (C-02) — a drift between two screens marks
      the desync tick. Unit-tested.
- [x] Expose the per-tick **joystick ring table** (`NetGame.lastJoy`) and the **last control
      byte sent** (`ByteChannel.lastControlByte`, `>= 0x80` only — joystick bytes are
      `<= 0x1f`) for the overlay. Unit-tested.
- [x] Add an `interop (live)` section to the D-key overlay: checksum (always), and when
      networked — tick (+ a `RING TIMEOUT` flag), last control byte tx, and the joystick
      ring bytes in hex.

## Acceptance

**Automated:** the checksum and the two telemetry fields are unit-tested; build/lint green.
**Manual (user):** with the browser in a ring (solo / Hatari / real ST bridge), the D
overlay shows a live, changing checksum and the joystick ring; on a real-ST-bridge stall
the `RING TIMEOUT` flag appears, and comparing two browsers' checksums pinpoints a desync.

## Notes

This is the in-repo half of EPIC-18; the validation itself runs against the user's Hatari
gateway and real ST bridge. A software ST-node model for CI was judged redundant — Hatari
is a better, real oracle and already passes. Checksum comparison across non-browser nodes
(ST/Hatari, which have no such display) is out of scope here; it localizes browser-side
and browser-vs-browser divergence, the practical case during bring-up.
