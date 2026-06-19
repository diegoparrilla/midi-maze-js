---
id: EPIC-06
iteration: 2
title: Pixel-faithful wall renderer
status: in-progress
---

## Goal

320x200 colour view: perspective wall-trapezoid projection, sky/floor, front-to-back draw list (draw3d.c, drawwall.c, makelist.c).

## Stories

- STORY-01: View setup + perspective projection (`calc_yx_to_xh`, viewport
  constants), golden-tested against the C.
- STORY-02: Render-list generation — `make_draw_list`, `draw_maze_calc_viewmatrix`,
  `draw_maze_generate_renderlist`, `draw_mazes_set_wall`/clip + the objecttable
  coverage cull. Golden-tested: the wall draw-list vs the C for sample viewpoints.
- STORY-03: Rasterize the draw list (trapezoid walls, sky/floor, edge lines) into
  the 320×200 canvas and wire a keyboard-driven camera through `step()` — the first
  visible first-person view. (Opponent sprites are EPIC-07.)

## Notes

Faithful grid-march renderer: walls are flat-shaded trapezoids in two colours
(magnesium/aluminium by axis), projected `sx = 80 - x*80/y`, `h = -5120/y`, drawn
mirrored around the horizon (y=50); the 3D window is 160×100 at screen (16,50) in
colour mode. The render list is data (x1,h1,x2,h2,color) so STORY-02 is golden-
testable; STORY-03's rasterization is validated visually. Rendering does not affect
determinism — no golden requirement on pixels. See draw3d.c, drawwall.c, makelist.c,
makedraw.c, rungame.c.
