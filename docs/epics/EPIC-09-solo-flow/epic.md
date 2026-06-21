---
id: EPIC-09
iteration: 2
title: Solo game flow
status: todo
---

## Goal

Init -> countdown -> play -> win/lose, wiring the sim core to renderer and input for offline solo play (maingame.c solo path).

NOTE (audit): the per-tick step()+render loop, keyboard input, and a placed-player
demo already exist in main.ts (built during EPIC-04/06/07). What remains is the flow
itself: countdown, win at GAME_WIN_SCORE, the game-over screen, and restart — plus
drones (EPIC-08) for opponents.

## Stories

Authored at the start of iteration 2 (just-in-time, per ITERATIONS.md).

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
