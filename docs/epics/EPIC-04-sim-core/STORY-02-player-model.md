---
id: STORY-02
epic: EPIC-04
title: Player & shot state model + initialisation
status: todo
---

## Goal

The `PLAYER_DATA` model and deterministic initial placement matching the C, so all
nodes start identically from the shared seed.

## Tasks

- [ ] `PLAYER_DATA` fields (pos x/y, dir, lives, reload, hitflag, score, gunman,
      team, shot x/y/dir/active, list links) per `globals.h`
- [ ] `init_all_player` / `hunt_ply_pos`: random empty-cell placement via the shared
      RNG, with the decreasing min-distance retry loop (`setup.c`/`gamelogi.c`)
- [ ] Golden vector: from a known seed + maze, the initial player positions

## Acceptance

**Automated:** TS initial placement matches the C harness vector for a fixed
seed+maze.
**Manual (user):** none.

## Notes

Placement consumes the shared RNG, so it must run in the exact same call order as
the C to stay in sync (C-02). Depends on STORY-01 RNG.
