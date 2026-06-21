---
id: STORY-04
epic: EPIC-20
title: Wire lobby into game start
status: done
---

## Goal

Make the lobby actually drive the game: build the world from `GameConfig`, start
from the lobby, and return to it between games.

## Tasks

- [x] `newWorld` builds from `GameConfig` (timings, lives, friendly fire, team flag +
      teams, drone counts, maze) instead of hardcoded values
- [x] Flow: lobby → (Start) → preview → play → game over → back to lobby
- [x] Open the lobby from the in-game menu (EPIC-11 MENU); "Start game" applies config
- [x] Status line / smoke check that the chosen config took effect

## Acceptance

**Automated:** build/lint green; config→world covered via STORY-01 tests.
**Manual (user):** set prefs + maze + name, Start, and the game reflects them; after a
game you return to the lobby.

## Notes

Replaces the hardcoded solo setup in `main.ts`. The host lobby here is what EPIC-15
will drive over the ring (its config becomes `MIDI_SEND_DATA`).
