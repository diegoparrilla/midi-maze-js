---
id: STORY-03
epic: EPIC-09
title: Game-over screen + restart
status: done
---

## Goal

When a player reaches `GAME_WIN_SCORE`, show the end screen (You win / `<player>`
wins) and let the player start a fresh game.

## Tasks

- [x] Game-over screen: winner's shape + "You win!" or "<player> wins!" text
      (faithful to `maingame.c:495-540`)
- [x] Restart on input (key/tap) → reset the world and return to the map preview
- [x] Wire into the main loop via the STORY-01 flow (gameover phase)
- [x] Status line reflects the phase (preview / playing / game over)

## Acceptance

**Automated:** none (rendering); flow transition into/out of gameover is covered by
STORY-01 tests.
**Manual (user):** winning or losing shows the end screen; a key starts a new game.

## Notes

Solo path only. Networked end-of-game handshake is a later (interop) epic.
