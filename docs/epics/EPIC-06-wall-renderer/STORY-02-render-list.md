---
id: STORY-02
epic: EPIC-06
title: Render-list generation (viewmatrix + visible walls)
status: todo
---

## Goal

Produce the ordered wall draw-list for a viewpoint, faithful to the C: the view
matrix, the 8-direction folding, the front-to-back grid march, FOV clipping, and the
objecttable coverage cull.

## Tasks

- [ ] `make_draw_list` + `dir_table` + `draw_maze_calc_viewmatrix` (`makedraw.c`, `drawwall.c`)
- [ ] `draw_maze_generate_renderlist` grid march (`makelist.c`)
- [ ] `draw_mazes_set_wall` + `draw_mazes_clip_wall` + objecttable coverage (`drawwall.c`)
- [ ] Golden vector: the wall draw-list (x1,h1,x2,h2,color) for sample positions/dirs
- [ ] Test asserting the TS draw-list matches the C harness

## Acceptance

**Automated:** the generated wall list matches the C harness for several viewpoints.
**Manual (user):** none (rasterization is STORY-03).

## Notes

The draw-list is pure data, so it is fully golden-testable. Sprites/shots
(`draw_mazes_set_object`) are stubbed here and implemented in EPIC-07.
