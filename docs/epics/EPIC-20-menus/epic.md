---
id: EPIC-20
iteration: 4
title: Menus & dialogs
status: todo
---

## Goal

Prefs (reload/regen/revive, drones), teams, name entry, maze select (prefdlg.c, master.c).
Pulled into iteration 4: the host lobby produces the `MIDI_SEND_DATA` payload (names,
maze, timings, teams, seed) and drives master mode, so it precedes EPIC-13/15.

## Stories

Authored just-in-time within iteration 4 (per ITERATIONS.md).

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
