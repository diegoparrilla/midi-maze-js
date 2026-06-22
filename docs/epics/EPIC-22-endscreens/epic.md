---
id: EPIC-22
iteration: 6
title: Popchart, noteboard & end animations
status: done
---

## Goal

Kill chart, score noteboard, and win/lose tongue/blink animations (popchart.c, notebrd.c, endshape.c).

## Stories

- STORY-01: Kills window (pop chart) — one dead face per kill in the right-hand panel
  (`popchart.c`). Authored early because the gap surfaced during ST testing (the panel
  is blank in the web build). The sim already records the data (`ply_score` +
  `ply_looser`); this is render + kill-order tracking.
- STORY-02: Win/lose end-screen animations (`endshape.c`) — the winner's face turns
  around + blinks, or shakes + shows a tongue.
- Score noteboard (`notebrd.c`) was already covered by `drawScoreboard` (EPIC-07), so
  no separate story is needed; this completes the epic.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
