---
id: STORY-03
epic: EPIC-06
title: Rasterize the draw list + wire a camera
status: todo
---

## Goal

Draw the wall list into the 320×200 canvas (faithful trapezoids, sky/floor, black
edge lines, two wall colours) and wire a keyboard-driven camera through `step()` —
the first visible first-person maze view.

## Tasks

- [ ] `draw_wall` (box + mirrored slanted edges) + `draw_vline` + sky/floor clear
      into the canvas at the (16,50) window (`draw3d.c`)
- [ ] `draw_list` back-to-front; two wall colours from the palette
- [ ] Wire into `main.ts`: keyboard → joystick byte → `step()` → render each frame;
      toggle vs the 2D map
- [ ] Confirm it renders (headless screenshot)

## Acceptance

**Automated:** build/lint stay green.
**Manual (user):** `npm run dev`, walk the maze in first person on desktop/phone.

## Notes

Rendering doesn't affect determinism, so this is validated visually rather than by
golden vectors. Opponent sprites/HUD are EPIC-07.
