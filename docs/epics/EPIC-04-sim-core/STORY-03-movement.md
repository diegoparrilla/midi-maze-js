---
id: STORY-03
epic: EPIC-04
title: Movement — turn, forward, collision
status: done
---

## Goal

`move_player` reproducing turning, forward/back motion, and wall + player collision
exactly.

## Tasks

- [x] Turn (`PLAYER_MOTION_ROTATE`), forward/back via `xy_speed_table` (`src/sim/movement.ts`)
- [x] Wall collision / clamp + outside-corner slide + boxed-in escape (`get_maze_data`)
- [x] Player–player collision (`PLAYER_RADIUS`, 3×3 cell scan, sliding resolve);
      `World.setAllPlayer` rebuilds the object map
- [x] Golden traces vs the C harness: spin, forward-east, wall-north, collision-west
      (`src/sim/movement.test.ts`); verbatim `move_player`/`move_shoot` now in `mmref.c`

## Acceptance

**Automated:** a multi-tick movement trace matches the C harness bit-for-bit.
**Manual (user):** none.

## Notes

Depends on STORY-01 (speed table, trig) and STORY-02 (player model). Extends the C
harness to drive `move_player`.
