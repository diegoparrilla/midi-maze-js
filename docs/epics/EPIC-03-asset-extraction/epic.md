---
id: EPIC-03
iteration: 1
title: Asset & maze extraction + reference vectors
status: todo
---

## Goal

Pull the original game's data into web-loadable form and build the golden reference
that guards determinism (D-06, D-07). After this epic, later epics can assert their
output matches the original byte-for-byte.

## Scope

- In scope: extracting the `.D8A` sine table, ball/face shapes, and title screens;
  loading the `.MAZ` maze to a canonical grid; generating reference vectors (maze
  grid, sine table, and — where feasible from the C — movement/shot traces).
- Out of scope: consuming these in the engine (that's EPIC-04/05/06/07); sounds
  (not in `.D8A` — synthesised in `sound.c`, EPIC-21).

## Stories

- STORY-01: Extract `.D8A` assets (sine table, ball & face shapes, title screens)
- STORY-02: Load the `.MAZ` maze to a canonical grid
- STORY-03: Golden reference vectors from the original C/Python

## Notes

Sources: `read_d8a.py`, `loadmaze.c` + `MIDIMAZE.PD/MIDIMAZE.MAZ`, and the C under
`../../../AtariST-MIDIMaze-Source/`. Read `README/D8AFileFormat.md` and
`README/MIDICommunication.md` first. The C compiles on macOS, so a small harness can
dump traces for the golden vectors. Decide asset bundling format (JSON for tables,
PNG sprite-sheet or raw for shapes). `.MZE`/`read_MZE.py` are MIDI Maze **2** — not
this game; an `.MZE` importer is optional later (STORY-02).
