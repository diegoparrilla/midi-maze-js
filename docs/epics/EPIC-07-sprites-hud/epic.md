---
id: EPIC-07
iteration: 2
title: Sprites, shadows & HUD
status: done
---

## Goal

Distance-scaled eyeball faces and shadows, crosshair, happy indicator, and scoreboard (drawshap.c, maze_set.c).

## Stories

- STORY-01: Sprite placement — `draw_mazes_set_object` (distance sort, size scaling,
  `face_shape_tab` face selection, shadow offset) adds player/shot entries to the
  draw list. Golden-tested: the full draw list (walls + sprites) vs the C.
- STORY-02: Sprite rasterization — `draw_shape` (body + face + shadow, per-player
  colours) into the canvas; visible opponents.
- STORY-03: HUD — crosshair, happy indicator, scoreboard (`happyind.c`, `notebrd.c`).
- STORY-04: Main-screen dashboard background (the synth panel from `MIDIMAZE.D8A`).

## Notes

Builds on EPIC-06's render list. STORY-01 replaces the EPIC-06 sprite stub and is
data (golden-testable); STORY-02/03 are validated visually. Sprite assets (24 ball
shapes, 20 faces) were extracted in EPIC-03. See `maze_set.c`, `drawshap.c`.
