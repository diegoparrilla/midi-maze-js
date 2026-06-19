---
id: STORY-02
epic: EPIC-06
title: Render-list generation (viewmatrix + visible walls)
status: done
---

## Goal

Produce the ordered wall draw-list for a viewpoint, faithful to the C: the view
matrix, the 8-direction folding, the front-to-back grid march, FOV clipping, and the
objecttable coverage cull.

## Tasks

- [x] `makeWallList` + `DIR_TABLE` + `calcViewmatrix` (`src/render/renderlist.ts`)
- [x] `generateRenderlist` grid march (`makelist.c`)
- [x] `setWall` + `clipWall` (FOV line intersections) + objecttable coverage cull
- [x] Golden vector: the wall draw-list (color,x1,h1,x2,h2) for 6 viewpoints (harness)
- [x] Test asserting the TS draw-list matches the C harness (`renderlist.test.ts`)

## Acceptance

**Automated:** the generated wall list matches the C harness for several viewpoints.
**Manual (user):** none (rasterization is STORY-03).

## Notes

The draw-list is pure data, so it is fully golden-testable. Sprites/shots
(`draw_mazes_set_object`) are stubbed here and implemented in EPIC-07.
