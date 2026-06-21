---
id: EPIC-09
iteration: 2
title: Solo game flow
status: done
---

## Goal

Init -> countdown -> play -> win/lose, wiring the sim core to renderer and input for offline solo play (maingame.c solo path).

NOTE (audit): the per-tick step()+render loop, keyboard input, and a placed-player
demo already exist in main.ts (built during EPIC-04/06/07). What remains is the flow
itself: countdown, win at GAME_WIN_SCORE, the game-over screen, and restart — plus
drones (EPIC-08) for opponents.

## Stories

- STORY-01: Flow state machine — `preview → playing → gameover → restart`, with a
  pure, unit-tested core (`findWinner`, phase/timer transitions) wired into the
  main loop. Win is the golden-tested `weDontHaveAWinner` flag from the sim.
- STORY-02: Start map-preview "countdown" (show the 2D map with all players for a
  faithful delay before play) + dead-player view (the shooter's face + greeting
  while you wait to respawn), per `maingame.c`.
- STORY-03: Game-over screen (You win / `<player>` wins, win vs. lose presentation)
  and restart-on-input back to a fresh game.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
