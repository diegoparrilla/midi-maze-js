---
id: STORY-01
epic: EPIC-13
title: Control bytes + MIDI_SEND_DATA codec
status: done
---

## Goal

The control-byte constants and a byte-exact codec for the `MIDI_SEND_DATA` (0x83)
shared-data block, so every node reconstructs the identical game from the wire
(D-02). Pure and unit-tested; no transport here.

## Tasks

- [x] Control-byte constants (`MASTER_ELECT 0x00`, `COUNT_PLAYERS 0x80`,
      `RESET_SCORE 0x81`, `TERMINATE_GAME 0x82`, `SEND_DATA 0x83`, `START_GAME 0x84`,
      `ABOUT 0x85`, `NAME_DIALOG 0x86`)
- [x] `encodeSendData({ names, maze, config, seed })`: name(s) zero-terminated, then
      maze-size, reload, regen, revive, lives, 3 drone counts, 4096 maze bytes,
      team-flag, 16 team bytes, friendly-fire, seed hi/lo — the exact order in
      `MIDICommunication.md`
- [x] `decodeSendData(bytes)` → `{ names, maze, config, seed }`
- [x] Unit tests: round-trip; a fixed-byte fixture asserting field order/offsets;
      name zero-termination; 4096-byte maze; seed hi/lo

## Acceptance

**Automated:** encode→decode round-trip + a byte-offset fixture covered by Vitest.
**Manual (user):** none (pure).

## Notes

`GameConfig` (EPIC-20) already holds reload/regen/revive/lives/friendly-fire/
team-flag/teams/drones; this maps it to/from the wire bytes. Maze is the 64×64
(4096) grid (`maze_datas`). Names are ASCII, 0-terminated; the multi-player
round-the-ring name accumulation is STORY-03 (here we encode/decode a given name
list).
