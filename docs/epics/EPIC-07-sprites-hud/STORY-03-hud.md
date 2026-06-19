---
id: STORY-03
epic: EPIC-07
title: HUD — crosshair, happy indicator, scoreboard
status: done
---

## Goal

The on-screen UI around the maze view: the firing crosshair, the happy indicator
(health face), and the score noteboard.

## Tasks

- [x] Crosshair when alive + reloaded (`maingame.c`) — `src/render/hud.ts`
- [x] Happy indicator / health face (`happyind.c`) — inline face bitmaps over ball shape 12,
      tongue when dead; lives→face uses the comment-aligned mapping
- [x] Score noteboard (`notebrd.c`) — faithful staff positions + ledger lines; note head is a
      drawn dot in the player colour (the tiny `mapsmily` bitmap is not extracted)
- [x] Confirmed the HUD renders (headless screenshot: happy face + score notes + crosshair)

## Acceptance

**Automated:** build/lint stay green.
**Manual (user):** crosshair, health, and score show around the maze view.

## Notes

Visual; no golden vectors. Layout matches the colour-mode HUD windows in `rungame.c`.
