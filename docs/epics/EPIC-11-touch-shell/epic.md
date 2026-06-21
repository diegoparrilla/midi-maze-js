---
id: EPIC-11
iteration: 3
title: Touch controls & responsive shell
status: done
---

## Goal

On-screen D-pad + fire, integer-upscaled responsive canvas, fullscreen and orientation handling for mobile.

## Stories

- STORY-01: Full-height responsive layout — fill the viewport height, centered
  horizontally, re-fit on viewport changes (D-12).
- STORY-02: Orientation gate & landscape lock — portrait rotate overlay (early
  startup gate) + best-effort landscape lock.
- STORY-03: Fullscreen & gesture suppression — fullscreen toggle + stop browser
  scroll/zoom gestures over the play area.
- STORY-04: On-screen control regions — place the D-pad (left) and FIRE + MENU
  (right) in the gutters flanking the play area (layout only).
- STORY-05: Menu button & overlay — MENU opens a minimal overlay (map toggle,
  fullscreen, restart) until the menus epic (EPIC-20).
- STORY-06: Touch input wiring — a unit-tested `Input` module merging keyboard +
  touch into the joystick byte; pointer handlers on the D-pad + fire.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
