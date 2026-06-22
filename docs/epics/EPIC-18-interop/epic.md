---
id: EPIC-18
iteration: 5
title: Mixed-ring interop
status: in-progress
---

## Goal

Validate a browser + Hatari (+ real ST) in one ring; reconcile any protocol gaps — the presentation goal.

## Stories

- STORY-01: Live interop telemetry overlay — a world checksum + the per-tick joystick ring
  + last control byte in the D-key debug overlay, to make a real-ST-bridge desync visible
  and localizable during bring-up.
- STORY-02: ST-bridge timing/pacing review — a tunable windowed-echo burst (`?sendWindow=N`)
  for the bridge's shallow MIDI buffer, plus per-tick ring-RTT in the overlay (vs the
  lock-step timeout) so a tightening real ring is visible before it false-times-out.

The Hatari gateway ↔ browser path already validates live; the real Atari ST bridge
(sidecartridge multidevice) ↔ browser path is the remaining manual validation (the user's
hardware), gated separately. A software ST-node model for CI was judged redundant against
the working Hatari oracle.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
