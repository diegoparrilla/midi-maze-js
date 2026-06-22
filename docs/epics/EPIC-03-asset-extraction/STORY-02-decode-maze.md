---
id: STORY-02
epic: EPIC-03
title: Load the .MAZ maze to a canonical grid
status: done
---

## Goal

The original `.MAZ` (ASCII) maze loaded to a canonical 64×64 wall/empty grid the
engine can use — matching `loadmaze.c`, the format the game we are porting uses.

## Tasks

- [x] Port `.MAZ` load (`loadmaze.c`): first 2 bytes = ASCII size digits, then
      `maze_size+2`-char rows of `X` (wall) / `.` (empty) with CR/LF handling (`src/maze.ts`)
- [x] Map to `MAZE_FIELD_WALL (1)` / `MAZE_FIELD_EMPTY (-1)`; out-of-bounds =
      1×1 checkerboard (`maze_obj.c`, `getMazeData`)
- [x] Use `MIDIMAZE.MAZ` (+ `BIGSTART`, `HUDSON`) vendored in `assets-src/mazes/`
- [x] Emit a canonical maze artifact (JSON grid + size) to `src/assets/generated/mazes/`
- [x] (Optional, later) `.MZE` (MIDI Maze 2) importer via `read_MZE.py` semantics
      — descoped: `.MZE` is MIDI Maze 2, a different format not used by this game (D-06)

## Acceptance

**Automated:** a spec loads `MIDIMAZE.MAZ` and asserts grid size and a known set of
wall cells; round-trips to the canonical artifact.
**Manual (user):** an ASCII dump of the loaded grid matches the source `.MAZ` file.

## Notes

`.MAZ` ≠ `.MZE`: `.MAZ` is the original game's plain Atari-ST text format; `.MZE` is
the encrypted/segmented MIDI Maze **2** format (that's what `read_MZE.py` decodes).
The **wire** maze (what `MIDI_SEND_DATA` ships, 4096 bytes) is the in-memory grid,
not the file — so slaves never parse a file; only master/solo loads one.
