---
id: EPIC-23
iteration: 6
title: Presentation hardening
status: done
---

## Goal

Multiple rooms, reconnect mid-game, and performance on low-end phones.

## Stories

- STORY-01: Low-end phone render perf — run-batch the sprite/HUD blitter (one fillRect per
  horizontal run instead of per pixel). `done`.
- STORY-02: Graceful mid-game drop / reconnect — a dropped ring shows "connection lost" and
  returns to the idle state (held link auto-reconnects) instead of a bogus game over. `done`.
- STORY-03: Room browser — `GET /rooms` list on the connect screen; click to join. `done`.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
