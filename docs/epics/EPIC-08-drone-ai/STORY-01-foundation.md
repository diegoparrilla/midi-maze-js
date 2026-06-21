---
id: STORY-01
epic: EPIC-08
title: Drone model + angle table + drone_setup
status: done
---

## Goal

Lay the drone foundation: the per-drone fields on `PLAYER_DATA`, the aim lookup
`calc_drone_angle_table`, and `drone_setup` (per-drone current/permanent target
assignment for both team and solo modes) — all golden-tested against the C.

## Tasks

- [x] Add the drone fields to the `Player` model (`dr_type`, `dr_*` plan/target
      fields, `dr_humanEnemies[18]`) + `activeDronesByType`/`machinesOnline` on `World`
- [x] Port `calc_drone_angle_table` (`calcDroneAngleTable`) + `assignDroneTypes`
- [x] Port `drone_setup` verbatim (team round-robin + solo rotating-human targeting,
      including the stale-index quirk that leaves a solo target drone at target -1)
- [x] Harness: dump `droneAngleTable` + 6 `droneSetup` scenarios (solo + team)
- [x] Test: angle table + all 6 setup scenarios match the C

## Acceptance

**Automated:** `droneAngleTable` and every `droneSetup` scenario match the C harness.
**Manual (user):** none (pure data).

## Notes

Drones are part of the shared deterministic sim (every node recomputes them), so each
piece is golden-tested like the rest of the sim (C-02). See `drone.c:47` and
`drone.c:78`.
