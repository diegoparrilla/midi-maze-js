---
id: STORY-03
epic: EPIC-04
title: Movement — turn, forward, collision
status: todo
---

## Goal

`move_player` reproducing turning, forward/back motion, and wall + player collision
exactly.

## Tasks

- [ ] Turn (`PLAYER_MOTION_ROTATE`), forward/back via `xy_speed_table`
- [ ] Wall collision / clamp (`PLAYER_WALL_DISTANCE`, `get_maze_data`)
- [ ] Player–player collision (`PLAYER_RADIUS`, the 5×5 cell scan, sliding resolve)
- [ ] Golden trace: scripted joystick → per-tick x/y/dir vs the C harness

## Acceptance

**Automated:** a multi-tick movement trace matches the C harness bit-for-bit.
**Manual (user):** none.

## Notes

Depends on STORY-01 (speed table, trig) and STORY-02 (player model). Extends the C
harness to drive `move_player`.
