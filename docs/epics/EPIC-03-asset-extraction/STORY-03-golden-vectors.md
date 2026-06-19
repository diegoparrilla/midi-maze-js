---
id: STORY-03
epic: EPIC-03
title: Golden reference vectors from the original C/Python
status: todo
---

## Goal

Committed reference vectors that later sim/render epics assert against, so we catch
desync the moment it appears (D-07, C-02).

## Tasks

- [ ] Build a minimal harness around the original C to dump deterministic traces
- [ ] Vector: sine table values (cross-check against extracted `.D8A` table)
- [ ] Vector: a scripted joystick sequence → per-tick player x/y/dir trace
- [ ] Vector: a shot fired down a corridor → shot path + hit tick
- [ ] Vector: shared-RNG sequence from a known seed (`rnd.c`)
- [ ] Commit vectors as data files + document how to regenerate them

## Acceptance

**Automated:** vectors load in Vitest; a placeholder spec confirms shapes/sizes.
(The real comparisons land in EPIC-04+.)
**Manual (user):** none.

## Notes

If compiling the full app is heavy, extract just the pure logic files
(`gamelogi.c`, `fastmath.c`, `rnd.c`, `maze_obj.c`) into a tiny CLI. These vectors
are the contract that keeps the browser in sync with real hardware.
