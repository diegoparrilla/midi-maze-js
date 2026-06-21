---
id: STORY-01
epic: EPIC-09
title: Solo game-flow state machine
status: done
---

## Goal

A small, pure flow controller for the solo game: `preview → playing → gameover`,
with restart, driven once per frame. Win detection reuses the sim's golden-tested
`weDontHaveAWinner` flag; the winner index is found exactly like `maingame.c`.

## Tasks

- [x] `findWinner(world)`: index whose score (team-aware) === `GAME_WIN_SCORE`, else
      -1 (matches `maingame.c:497-498`)
- [x] `GameFlow` controller: phases `preview`/`playing`/`gameover` + frame timers;
      `tick()` advances the phase and reports when to `step()` the sim vs. restart
- [x] Restart resets the world (re-init players/drones, reseed) back to `preview`
- [x] Unit tests for transitions (preview→playing→gameover→restart) and `findWinner`

## Acceptance

**Automated:** flow transitions + `findWinner` covered by Vitest.
**Manual (user):** none (logic only; visuals are STORY-02/03).

## Notes

Pure module (no DOM), so it is unit-testable. The win condition itself is already
proven against the C in the sim golden tests; this only sequences the phases.
