---
id: EPIC-14
iteration: 4
title: Per-tick ring loop & lock-step pump
status: done
---

## Goal

The maingame.c send/receive ring loop over the async transport, plus control bytes 0x81-0x86 (C-01).

## Stories

- STORY-01: Joystick ring exchange — one tick of the `maingame.c` send/receive ring
  over the async channel: send our own byte, receive the others round the ring into
  the joystick table (`[0, machinesOnline)`), faithful order/direction, tight timeout
  (C-01). Loopback-tested (ring of one returns our own byte to our slot).
- STORY-02: Lock-step game pump — drive a networked game tick: read local input →
  ring-exchange → `step(world, joyTable)` → render, each frame; handle the
  TERMINATE_GAME control byte; surface timeout/drop as a clean game end.
- STORY-03: Determinism over the wire — a ring-of-one networked game against a live
  `orchestrator.py --ws` runs N ticks and matches a purely-local sim with the same
  seed/config/joystick stream, bit-for-bit (proves D-02/C-02 across the transport).

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
