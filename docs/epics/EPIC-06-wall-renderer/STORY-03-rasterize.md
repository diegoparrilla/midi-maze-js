---
id: STORY-03
epic: EPIC-06
title: Rasterize the draw list + wire a camera
status: done
---

## Goal

Draw the wall list into the 320×200 canvas (faithful trapezoids, sky/floor, black
edge lines, two wall colours) and wire a keyboard-driven camera through `step()` —
the first visible first-person maze view.

## Tasks

- [x] `draw_wall` (box + mirrored slanted edges) + `draw_vline` + sky/floor clear
      into the canvas at the (16,50) window (`src/render/view3d.ts`)
- [x] `draw_list` back-to-front; two wall colours (magnesium/aluminium) from the palette
- [x] Wire into `main.ts`: keyboard → joystick byte → `step()` → render each frame;
      `M` toggles the 2D map
- [x] Confirmed it renders (headless screenshot: corridor with perspective walls)

## Acceptance

**Automated:** build/lint stay green.
**Manual (user):** `npm run dev`, walk the maze in first person on desktop/phone.

## Notes

Rendering doesn't affect determinism, so this is validated visually rather than by
golden vectors. Opponent sprites/HUD are EPIC-07.
