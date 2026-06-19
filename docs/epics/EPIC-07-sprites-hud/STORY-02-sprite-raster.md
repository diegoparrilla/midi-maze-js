---
id: STORY-02
epic: EPIC-07
title: Sprite rasterization (body + face + shadow)
status: done
---

## Goal

`draw_shape`: draw the eyeball body, face (one of 20 rotations), and the shadow,
scaled by size and coloured per player — so opponents are visible.

## Tasks

- [x] `init_faces_shapes` equivalent: shadow image derived from each ball shape;
      geometry from the extracted ball/face shapes (`src/render/shapes.ts`)
- [x] `draw_shape` (body in back colour, face in frame colour, shadow in dk-green)
      blitting 1bpp masks in a solid colour into the view window
- [x] Per-player colour tables (`color_ply_back`/`color_ply_frame`)
- [x] Confirmed opponents render (headless screenshot: yellow eyeball + face + shadow)

## Acceptance

**Automated:** build/lint stay green.
**Manual (user):** other players appear as scaled eyeball faces with shadows.

## Notes

A shot is the body from behind (`BODY_SHAPE_BACK_VIEW`, no face). Depends on STORY-01.
