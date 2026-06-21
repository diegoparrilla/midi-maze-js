---
id: STORY-06
epic: EPIC-11
title: Touch input wiring (D-pad + fire)
status: done
---

## Goal

Make the on-screen controls actually drive the game: a single input path that merges
keyboard + touch into the exact joystick byte the sim already consumes.

## Tasks

- [x] `Input` module: merge held keys + on-screen button state into one `joyByte()`
      (UP/DOWN/LEFT/RIGHT/BUTTON bits from `globals.h`); unit-tested
- [x] Pointer-event handlers on the D-pad + FIRE zones (multi-touch: move + fire at
      once), `touch-action: none` so they don't scroll/zoom
- [x] `main.ts` uses the `Input` module for both keyboard and touch

## Acceptance

**Automated:** `Input.joyByte()` merge covered by Vitest; build/lint green.
**Manual (user):** on a phone the D-pad turns/moves and FIRE shoots; keyboard still
works on desktop.

## Notes

The byte must be identical to the keyboard path so the deterministic sim (D-02) is
unaffected. Pure merge logic is unit-tested; the pointer wiring is visual. Depends on
the STORY-04 control regions.
