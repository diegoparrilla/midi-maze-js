---
id: STORY-03
epic: EPIC-03
title: Golden reference vectors from the original C/Python
status: done
---

## Goal

Committed reference vectors that later sim/render epics assert against, so we catch
desync the moment it appears (D-07, C-02).

## Tasks

- [x] Vector: sine table values, cross-checked against `trunc(sin·256)` (`assets.test.ts`)
- [x] Vector: maze grids (canonical JSON) cross-checked against an independent
      ASCII parse and the loader (`maze.test.ts`, `assets.test.ts`)
- [x] Document the golden-master approach + regen (`docs/reference/golden-master.md`)
- [x] Build a minimal C harness (carve `gamelogi.c`/`fastmath.c`/`rnd.c`/`maze_obj.c`
      into a CLI) — delivered as `scripts/cref/mmref.c` + `scripts/gen-cref.ts` (`npm run cref`)
- [x] Vector: scripted joystick → per-tick player x/y/dir trace — `movement` + `match`
      vectors (incl. the EPIC-17 fuzz matches), asserted by `movement.test.ts` / `step.test.ts`
- [x] Vector: shot down a corridor → path + hit tick — `combat` vectors (`shoot-wall`,
      `shoot-hit`, `kill-respawn`), asserted by `combat.test.ts`
- [x] Vector: shared-RNG sequence from a known seed (`rnd.c`) — `rng` vectors (random /
      rnd14 / rnd256 + the EPIC-17 long-run & per-maxVal sequences), asserted by `primitives.test.ts`

## Acceptance

**Automated:** every vector loads in Vitest and is asserted bit-for-bit against the TS
port (`primitives`/`movement`/`combat`/`step`/`drone` golden tests, all green).
**Manual (user):** none.

## Notes

The sine + maze vectors landed first; the movement/shot/RNG trace harness was deliberately
deferred to the start of EPIC-04 and built there as `scripts/cref/mmref.c` (the carved-out
CLI over `gamelogi.c`/`fastmath.c`/`rnd.c`/`maze_obj.c`), so the traces were compared
bit-for-bit alongside the port. EPIC-17 later broadened the same harness (fuzz matches,
overflow + long-run RNG vectors). Plan and regen in `docs/reference/golden-master.md`.
