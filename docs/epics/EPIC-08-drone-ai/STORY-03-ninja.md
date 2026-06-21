---
id: STORY-03
epic: EPIC-08
title: Ninja drone (pathfinding)
status: done
---

## Goal

The NINJA drone: when it can't see its target it plans a multi-step route around
obstructions (`drone_sub_ninja` + `drone_sub_ninja_plan/north/south/east/west` and
the `dr_dir[]`/`dr_field[]` plan state machine). This is the bulk of `drone.c`.

## Tasks

- [x] Port `drone_action` NINJA case (hit-retarget, dead-target re-acquire, plan reset)
- [x] Port `drone_sub_ninja` (visible-axis search → aim, else build a plan; plan exec)
- [x] Port `drone_sub_ninja_plan` + `drone_sub_ninja_north/south/east/west`
- [x] Harness: `run_drones` scenarios with ninja drones (joystick + state dump, +fieldIndex)
- [x] Test: 4 ninja `droneTrace` scenarios match the C across 120 ticks (direct + via step())

## Acceptance

**Automated:** ninja `ninjaTrace` scenarios match the C harness across 120 ticks,
both calling `droneAction` directly and driven through `step()`.
**Manual (user):** a ninja drone navigates the maze toward the player around walls.

## Notes

~3,400 lines of recursive route planning — the largest single piece of `drone.c`.
The harness copies the ninja functions verbatim from `drone.c`; the TS port was
produced by a mechanical transform of the same source (do/while structure, field
indices and conditions preserved) and verified bit-for-bit by the golden traces.
The deeply-nested planners use local can-go flags (`Dirs`) rather than the module
flags. Soak-tested 5,000 ticks (target + standard + ninja) with no hang or crash.
See `drone.c:742` (`drone_sub_ninja`) and `drone.c:1560` (`drone_sub_ninja_plan`).
