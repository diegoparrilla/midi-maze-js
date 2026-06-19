---
id: STORY-03
epic: EPIC-03
title: Golden reference vectors from the original C/Python
status: in-progress
---

## Goal

Committed reference vectors that later sim/render epics assert against, so we catch
desync the moment it appears (D-07, C-02).

## Tasks

- [x] Vector: sine table values, cross-checked against `trunc(sin·256)` (`assets.test.ts`)
- [x] Vector: maze grids (canonical JSON) cross-checked against an independent
      ASCII parse and the loader (`maze.test.ts`, `assets.test.ts`)
- [x] Document the golden-master approach + regen (`docs/reference/golden-master.md`)
- [ ] Build a minimal C harness (carve `gamelogi.c`/`fastmath.c`/`rnd.c`/`maze_obj.c`
      into a CLI) — deferred to EPIC-04 start (see Notes)
- [ ] Vector: scripted joystick → per-tick player x/y/dir trace — deferred to EPIC-04
- [ ] Vector: shot down a corridor → path + hit tick — deferred to EPIC-04
- [ ] Vector: shared-RNG sequence from a known seed (`rnd.c`) — deferred to EPIC-04

## Acceptance

**Automated:** vectors load in Vitest; a placeholder spec confirms shapes/sizes.
(The real comparisons land in EPIC-04+.)
**Manual (user):** none.

## Notes

The sine + maze vectors are delivered and tested now. The movement/shot/RNG trace
harness is **deliberately deferred to the start of EPIC-04**: the traces are only
useful once `move_player`/`fast_sin`/`rnd` are being ported, and building the
carved-out CLI alongside that code lets us compare bit-for-bit incrementally. Plan
and rationale in `docs/reference/golden-master.md`. The original compiles on macOS
but as an Xcode AppKit app, hence the carve-out rather than reusing the app target.
