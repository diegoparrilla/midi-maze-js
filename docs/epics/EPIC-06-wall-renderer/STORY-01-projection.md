---
id: STORY-01
epic: EPIC-06
title: View setup + perspective projection
status: done
---

## Goal

The colour-mode viewport constants and the perspective projection `calc_yx_to_xh`
that turns a view-space point (depth y, lateral x) into screen (x, height), matching
the C exactly.

## Tasks

- [x] Viewport constants (hcenter 80, halfwidth 80, sky/floor 50, cell_pixels 20,
      window at screen 16,50) in `src/render/projection.ts`
- [x] `calcYxToXh(y,x)` → `[screenX, height]` using `mulsDivs` (`draw3d.c`)
- [x] Golden vector: sample `(y,x)` → `(sx,h)` from the C harness (`projection` block)
- [x] Test asserting the TS projection matches the C for every sample (`projection.test.ts`)

## Acceptance

**Automated:** `npm test` shows `calcYxToXh` matches the C harness for all samples.
**Manual (user):** none (visible output is STORY-03).

## Notes

`h = -(cell_pixels*MAZE_CELL_SIZE)/y = -5120/y`; `sx = hcenter - x*halfwidth/y`.
y is negative (in front). Integer math via `mulsDivs` (C-02).
