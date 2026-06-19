---
id: STORY-02
epic: EPIC-07
title: Sprite rasterization (body + face + shadow)
status: todo
---

## Goal

`draw_shape`: draw the eyeball body, face (one of 20 rotations), and the shadow,
scaled by size and coloured per player — so opponents are visible.

## Tasks

- [ ] `init_faces_shapes` equivalent: per-size body/face offsets + the derived shadow
      image, from the extracted ball/face shapes
- [ ] `draw_shape` (body in back colour, face in frame colour, shadow in dk-green)
      blitting 1bpp masks in a solid colour into the view window
- [ ] Per-player colour tables (`color_cnv_back`/`color_cnv_frame`)
- [ ] Confirm opponents render (headless screenshot)

## Acceptance

**Automated:** build/lint stay green.
**Manual (user):** other players appear as scaled eyeball faces with shadows.

## Notes

A shot is the body from behind (`BODY_SHAPE_BACK_VIEW`, no face). Depends on STORY-01.
