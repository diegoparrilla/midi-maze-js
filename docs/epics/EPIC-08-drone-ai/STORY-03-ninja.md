---
id: STORY-03
epic: EPIC-08
title: Ninja drone (pathfinding)
status: todo
---

## Goal

The NINJA drone: when it can't see its target it plans a multi-step route around
obstructions (`drone_sub_ninja` + `drone_sub_ninja_plan/north/south/east/west` and
the `dr_dir[]`/`dr_field[]` plan state machine). This is the bulk of `drone.c`.

## Tasks

- [ ] Port `drone_action` NINJA case (hit-retarget, dead-target re-acquire, plan reset)
- [ ] Port `drone_sub_ninja` (visible-axis search → aim, else build a plan)
- [ ] Port `drone_sub_ninja_plan` + `drone_sub_ninja_north/south/east/west`
- [ ] Harness: `run_drones` scenarios with ninja drones (joystick + plan-state dump)
- [ ] Test: ninja `droneTrace` scenarios match the C across many ticks

## Acceptance

**Automated:** ninja `droneTrace` scenarios match the C harness.
**Manual (user):** a ninja drone navigates the maze toward the player around walls.

## Notes

~3,400 lines of recursive route planning — the largest single piece of `drone.c`.
Sequenced last (after the playable target/standard opponents). See `drone.c:742`
(`drone_sub_ninja`) and `drone.c:1560` (`drone_sub_ninja_plan`).
