---
id: STORY-01
epic: EPIC-05
title: Maze model, loader & grid access
status: done
---

## Goal

A 64×64 maze grid loaded from `.MAZ` with the original access semantics. (Delivered
across EPIC-03/04; recorded here so the tracker is accurate.)

## Tasks

- [x] `.MAZ` (ASCII) loader → 64×64 WALL/EMPTY grid (`src/maze.ts:parseMaz`, EPIC-03)
- [x] `getMazeData` with out-of-bounds 1×1 checkerboard + flipped-axis access
- [x] Mutable runtime grid + object placement (`src/sim/world.ts`:
      `getMazeData`/`setMazeData`/`setObject`/`setAllPlayer`, EPIC-04)
- [x] Tested: `src/maze.test.ts`, `src/assets.test.ts` (independent + golden)

## Acceptance

**Automated:** the maze tests pass; placement/movement/render epics consume this grid.
**Manual (user):** the maze loads and renders correctly.

## Notes

Scope was implemented under EPIC-03 STORY-02 (loader) and EPIC-04 (world grid/objects);
this story closes EPIC-05 as already delivered. Optional `.MZE` (MIDI Maze 2) import
remains a later, separate concern.
