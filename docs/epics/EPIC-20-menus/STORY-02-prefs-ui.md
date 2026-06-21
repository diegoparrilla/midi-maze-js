---
id: STORY-02
epic: EPIC-20
title: Lobby prefs UI
status: done
---

## Goal

A lobby overlay that edits the `GameConfig`: the game-rule prefs, drone counts, and
the player name — the browser stand-in for the Play/Team dialog.

## Tasks

- [x] Prefs controls: reload/regen/revive fast↔slow toggles, lives 1/2/3,
      friendly-fire on/off, team-mode on/off
- [x] Drone counts per type (target/standard/ninja) with +/- steppers, clamped to
      the free-slot cap (`maxDrones`)
- [x] Player-name field
- [x] Touch-friendly + keyboard-usable; reads/writes the STORY-01 `GameConfig`

## Acceptance

**Automated:** build/lint green (pure logic is STORY-01).
**Manual (user):** changing prefs/drones/name in the lobby updates the config used
for the next game.

## Notes

Maze selection is STORY-03; wiring "Start" into the game is STORY-04. Per-player team
assignment UI appears only when team mode is on (solo defaults to one team).
