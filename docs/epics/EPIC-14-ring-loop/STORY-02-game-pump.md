---
id: STORY-02
epic: EPIC-14
title: Lock-step game pump
status: done
---

## Goal

Drive a whole networked game tick by tick on top of the ring exchange: the networked
counterpart of the solo frame loop, keeping every node in lock-step.

## Tasks

- [x] Per tick: read local input → `exchangeJoysticks` (STORY-01) → `step(world,
      joyTable, dronesActive)` → render; advance until a winner or a control byte
- [x] Handle the `MIDI_TERMINATE_GAME (0x82)` byte in the joystick stream (master
      injects it on quit; slaves act on it) → clean game end
- [x] On exchange timeout / transport drop, end the game with a clear status (the
      ring "boo-boo"), not a hang or desync
- [x] A `NetGame` driver decoupled from the DOM so it is unit-testable with a fake
      channel + a stub renderer

## Acceptance

**Automated:** the pump loop (tick → step, terminate, timeout) covered by Vitest with
a fake channel.
**Manual (user):** with two browsers (EPIC-16) a full game runs; here, a ring-of-one
game runs to a winner.

## Notes

Reuses the EPIC-09 `GameFlow`/render and the EPIC-13 `runSetup` result (world, seed,
ownNumber, machinesOnline). Wiring the host start from the lobby is EPIC-15.
