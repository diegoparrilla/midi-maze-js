---
id: STORY-02
epic: EPIC-08
title: Target + standard drones
status: done
---

## Goal

`drone_action` for the TARGET (wanders, never fires) and STANDARD (chases + fires)
drone types, generating one joystick byte per drone per tick — bit-faithful to
`drone.c`, verified with multi-tick joystick traces.

## Tasks

- [x] Port `drone_move`, `drone_check_directions`, `drone_sub_findMoveToTarget`,
      `drone_generate_joystickdata` + the move primitives (up/upleft/upright/turn)
- [x] Port `drone_aim2target`, `drone_delta_into_direction`, the 4
      `drone_isTargetIsVisible*` helpers, `drone_set_position`, `drone_sub_standard`
- [x] Port `drone_action` TARGET + STANDARD cases (NINJA case deferred to STORY-03)
- [x] Harness: `run_drones` game-loop scenario dumping each drone's joystick + state
- [x] Test: 4 `droneTrace` scenarios (40 ticks each) match the C

## Acceptance

**Automated:** the 4 `droneTrace` scenarios (generated joystick bytes + resulting
player state) match the C harness across 40 ticks.
**Manual (user):** opponents move and the standard drone hunts/fires in the demo.

## Notes

Two `drone.c` bugs are preserved verbatim (a double-`rnd()` else-if, and the
always-true `!= NINJA || != STANDARD` test). A solo target drone has no real target
(`dr_currentTarget < 0`); the original reads `player_data[-1]` (UB-but-deterministic
neighbour memory). We treat "no target" as the drone itself (zero distance) so it
wanders without crashing — a path the golden never exercises. See `drone.c:303`.
