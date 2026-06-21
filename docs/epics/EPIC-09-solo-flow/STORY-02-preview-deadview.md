---
id: STORY-02
epic: EPIC-09
title: Map-preview countdown + dead-player view
status: done
---

## Goal

Render the two flow states the player sees besides normal play: the start-of-game
map preview (the 2D map with all players, shown for a faithful delay), and the
dead-player view (the killer's face + greeting while waiting to respawn).

## Tasks

- [x] Preview phase renders the 2D map with all players for the preview duration
- [x] Dead view: when player 0 has no lives, draw the shooter's front-view shape +
      "<player> says: Have a nice day!" (faithful to `maingame.c:313-334`)
- [x] Hit flash: flash the background in the shooter's colour when player 0 is hit
- [x] Wire both into the main render loop driven by the STORY-01 flow

## Acceptance

**Automated:** none (rendering).
**Manual (user):** the game opens on the map preview, then plays; dying shows the
killer's face until respawn, and getting hit flashes the screen.

## Notes

Visual parity with the original solo path; uses existing `drawMap2D` / `drawShape`.
