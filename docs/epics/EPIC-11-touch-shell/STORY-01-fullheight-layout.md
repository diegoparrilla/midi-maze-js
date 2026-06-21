---
id: STORY-01
epic: EPIC-11
title: Full-height responsive layout
status: done
---

## Goal

The play area fills the viewport height with no top/bottom gaps, centered
horizontally, and re-fits whenever the viewport changes (D-12).

## Tasks

- [x] Pure scale helper: given viewport + base 320x200, return the display size —
      fill-height (touch/coarse pointer) vs. largest integer scale (desktop),
      horizontally centered. Unit-tested.
- [x] Apply it in the shell: canvas fills height, centered L/R, `image-rendering:
      pixelated`, no top/bottom gaps on mobile
- [x] Re-fit on `resize`, `orientationchange`, and `fullscreenchange`

## Acceptance

**Automated:** scale helper unit-tested; build/lint green.
**Manual (user):** on a landscape phone the play area touches top and bottom and is
centered; resizing/rotating re-fits cleanly.

## Notes

Implements D-12 (amends D-04): mobile fills height with nearest-neighbor scaling;
desktop keeps integer upscale. Framebuffer stays 320x200 — display scaling only.
