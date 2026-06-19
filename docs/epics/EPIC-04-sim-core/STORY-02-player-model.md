---
id: STORY-02
epic: EPIC-04
title: Player & shot state model + initialisation
status: done
---

## Goal

The `PLAYER_DATA` model and deterministic initial placement matching the C, so all
nodes start identically from the shared seed.

## Tasks

- [x] `PLAYER_DATA` fields (`src/sim/player.ts`); mutable maze + object placement
      (`src/sim/world.ts`: `getMazeData`/`setMazeData`/`setObject`)
- [x] `init_all_player` / `hunt_ply_pos` (`src/sim/setup.ts`): RNG-driven placement
      with the decreasing min-distance retry loop
- [x] Golden vector: initial positions + facings vs the C harness (extended
      `mmref.c` with a shared maze fixture; `src/sim/setup.test.ts`)

## Acceptance

**Automated:** TS initial placement matches the C harness vector for a fixed
seed+maze.
**Manual (user):** none.

## Notes

Placement consumes the shared RNG, so it must run in the exact same call order as
the C to stay in sync (C-02). Depends on STORY-01 RNG.
