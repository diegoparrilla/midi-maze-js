---
id: EPIC-20
iteration: 4
title: Menus & dialogs
status: done
---

## Goal

Prefs (reload/regen/revive, drones), teams, name entry, maze select (prefdlg.c, master.c).
Pulled into iteration 4: the host lobby produces the `MIDI_SEND_DATA` payload (names,
maze, timings, teams, seed) and drives master mode, so it precedes EPIC-13/15.

## Stories

- STORY-01: `GameConfig` model & defaults — the data the lobby produces (timings
  fast/slow, lives 1–3, friendly fire, team flag + per-player teams, drone counts
  with free-slot cap, maze id, player name). Pure, unit-tested; maps to the World
  config fields and the future `MIDI_SEND_DATA` payload.
- STORY-02: Lobby prefs UI — an overlay to edit timings, lives, friendly fire, team
  mode, per-type drone counts (capped), and the player name.
- STORY-03: Maze selection — pick among the vendored mazes (bigstart/hudson/midimaze)
  in the lobby; load the chosen maze into the game.
- STORY-04: Wire lobby → game start — config-driven `newWorld`; lobby → preview →
  play; restart returns to the lobby. Reachable from the in-game menu.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
