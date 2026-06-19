---
id: STORY-03
epic: EPIC-07
title: HUD — crosshair, happy indicator, scoreboard
status: in-progress
---

## Goal

The on-screen UI around the maze view: the firing crosshair, the happy indicator
(health face), and the score noteboard.

## Tasks

- [x] Crosshair when alive + reloaded (`maingame.c`) — `src/render/hud.ts`
- [ ] Happy indicator / health face (`happyind.c`) — inline face bitmaps + ball shape 12
- [ ] Score noteboard (`notebrd.c`) — staff + note heads (needs `mapsmily` from moreshap.c)
- [ ] Confirm the HUD renders (headless screenshot)

## Acceptance

**Automated:** build/lint stay green.
**Manual (user):** crosshair, health, and score show around the maze view.

## Notes

Visual; no golden vectors. Layout matches the colour-mode HUD windows in `rungame.c`.
