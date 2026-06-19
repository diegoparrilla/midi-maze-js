---
id: STORY-04
epic: EPIC-08
title: Integrate drones into step() + demo
status: done
---

## Goal

Drive the drones from the per-tick `step()` (each drone generates its joystick byte
before the hit-flag reset, exactly like `maingame.c`), and wire drones into the solo
demo so there are live opponents.

## Tasks

- [x] Call `drone_action` for slots `[machinesOnline, count)` inside `step()`, before
      the hit-flag reset; move players from the drone-generated joystick table
- [x] Test: the `droneTrace` scenarios re-driven through `step()` match the C state
- [x] Wire 1 target + 1 standard drone into the solo demo (`main.ts`)
- [x] Soak: 5000 demo ticks run without desync/crash

## Acceptance

**Automated:** the `droneTrace` player state matches the C when produced via `step()`.
**Manual (user):** in the solo demo the two drones move and the standard one attacks.

## Notes

`step()` makes a mutable copy of the joystick table; drone slots are overwritten by
`drone_action`, human slots are read as-is. Matches the maingame.c loop order. See
`maingame.c:426`.
