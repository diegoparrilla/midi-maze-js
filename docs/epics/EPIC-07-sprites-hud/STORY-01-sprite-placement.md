---
id: STORY-01
epic: EPIC-07
title: Sprite placement into the render list
status: done
---

## Goal

`draw_mazes_set_object`: add player/shot sprites to the render list with distance
sorting, size scaling, `face_shape_tab` face selection, and shadow offset — faithful
to the C. Replaces the EPIC-06 stub.

## Tasks

- [x] Refactor the render list to a generic draw-elem (`DrawElem` type + 5 fields)
      + an `ownNumber` view parameter (`makeDrawList`)
- [x] Port `draw_mazes_set_object` (rotate to view space, sort by distance, size
      `-4000/distance` clamp 1..32, `face_shape_tab`, shadow offset, hidden-cull)
- [x] Harness: full draw-list dump + 2 sprite viewpoints (placed players)
- [x] Test: the full draw list (walls + sprites) matches the C for 8 viewpoints

## Acceptance

**Automated:** the draw list (walls + player/shot sprites) matches the C harness for
the sprite viewpoints.
**Manual (user):** none (rasterization is STORY-02).

## Notes

Self (`own_number`) and anything behind the viewer are skipped. Sprite colour field
is the player index (or `gunman` if hit); `draw_shape` maps it to palette colours.
