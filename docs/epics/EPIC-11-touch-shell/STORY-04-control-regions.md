---
id: STORY-04
epic: EPIC-11
title: On-screen control regions (layout)
status: done
---

## Goal

Place the on-screen controls in the gutters that flank the centered play area, so
they never cover the maze. Placement/containers only — input wiring is STORY-06.

## Tasks

- [x] On touch / coarse-pointer devices, reserve the left/right gutters beside the
      centered canvas as control regions
- [x] Left gutter = D-pad zone (bottom); right gutter = FIRE + MENU zone
      (FIRE bottom, MENU top) — containers + styling only
- [x] Narrow-landscape fallback: when the gutters are too thin, overlay the controls
      translucently in the bottom corners over the play area
- [x] Controls hidden on non-touch (desktop) devices

## Acceptance

**Automated:** build/lint green.
**Manual (user):** on a phone the D-pad sits left of the maze and FIRE/MENU right of
it; on a narrow screen they tuck into the bottom corners; desktop shows none.

## Notes

The buttons are inert here; STORY-06 wires them to the joystick byte. Thumb-reachable
defaults: D-pad bottom-left, FIRE bottom-right, MENU top-right.
