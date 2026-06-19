---
id: EPIC-05
iteration: 2
title: Maze model & loader
status: done
---

## Goal

Load a .MAZ (ASCII) maze into a 64x64 grid (loadmaze.c) with access semantics
matching maze_obj.c (out-of-bounds checkerboard). Slaves receive the grid over the
wire (MIDI_SEND_DATA); file loading is only for master/solo. Optional .MZE (MIDI
Maze 2) import is a later, separate concern.

## Stories

Authored at the start of iteration 2 (just-in-time, per ITERATIONS.md).

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
