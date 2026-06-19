---
id: STORY-04
epic: EPIC-07
title: Main-screen dashboard background
status: done
---

## Goal

Draw the original synth-dashboard main screen behind the maze view and HUD (the
"picture around" — keyboard, musical staff, panels, logos), so the screen matches
the real game. This is the colour main-screen bitmap from `MIDIMAZE.D8A`, deferred
as a bonus in EPIC-03.

## Tasks

- [x] Port the main-screen image decode (vertical RLE + 4 bitplanes -> 320x200) from
      `read_d8a.py`/`convert_title`; emit `src/assets/generated/main-screen.png`
      (minimal PNG encoder in `scripts/extract-assets.ts`)
- [x] Draw the dashboard as the background each frame; `drawView3D` now only paints
      its 160x100 window, HUD panels composite on top (`src/main.ts`)
- [x] `src/vite-env.d.ts` so `.png` imports type as URLs
- [x] Confirmed it renders (headless screenshot matches the original dashboard)

## Acceptance

**Automated:** build/lint/test stay green.
**Manual (user):** the screen shows the synth dashboard (keyboard, staff, panels)
with the maze view, health face, and score notes in their panels.

## Notes

The HUD coordinates (view 16,50; health 128,16; score staff 192,10) are the
dashboard's panel positions, so everything lines up. Decode verified pixel-identical
to the source `images/TITLE_COL.PNG`.
