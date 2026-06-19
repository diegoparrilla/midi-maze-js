---
id: EPIC-08
iteration: 2
title: Drone AI parity
status: in-progress
---

## Goal

Target / standard / ninja drones reproducing drone.c, driving player_joy_table[] deterministically.

## Stories

- STORY-01: Drone model + `calc_drone_angle_table` + `drone_setup` (target
  assignment, teams). Golden-tested.
- STORY-02: TARGET + STANDARD drones — `drone_action` for those types, `drone_move`,
  `drone_generate_joystickdata`. Golden joystick traces.
- STORY-03: NINJA drone — pathfinding (`drone_sub_ninja` + plan/visibility helpers).
  Golden joystick traces. (This is the bulk of `drone.c`.)
- STORY-04: Integrate into `step()` (drones move before players each tick); multi-tick
  golden trace; wire drones into the solo demo.

## Notes

`drone.c` is ~4,826 lines — the largest subsystem, dominated by the ninja AI. Drones
are deterministic (they write `player_joy_table[]`), so each piece is golden-tested
against the C harness like the sim. Drone types: TARGET (wanders, never fires),
STANDARD (chases + fires), NINJA (pathfinds). Multi-turn; build foundation +
target/standard first (playable opponents), then the ninja. See `drone.c`, `Drones.md`.
