---
id: STORY-01
epic: EPIC-20
title: GameConfig model & defaults
status: done
---

## Goal

A pure config model for everything the lobby decides — the same fields the original
prefs/team dialogs set (`prefdlg.c`, `master.c`) and that later become the
`MIDI_SEND_DATA` block. No DOM, so it is unit-tested.

## Tasks

- [x] `GameConfig` type + `defaultConfig()`: `reloadTime`/`regenTime`/`reviveTime`
      (fast/slow values from `globals.h`: 10/30, 100/200, 50/100), `reviveLives`
      (1–3), `friendlyFire`, `teamFlag`, `teams[]`, `drones` `[target,standard,ninja]`,
      `mazeId`, `playerName`
- [x] `maxDrones(config, humanCount)` — free-slot cap (`PLAYER_MAX_COUNT - humans`),
      matching `do_preference_form`'s `possibleDroneCount`
- [x] `applyConfig(world, config)` (or a config-taking `newWorld`) that sets the
      World's timing/team/drone fields from the config
- [x] Unit tests: defaults, drone cap clamp, config → World mapping

## Acceptance

**Automated:** model defaults + cap + mapping covered by Vitest.
**Manual (user):** none (logic only).

## Notes

Faithful in the *values it produces* (the wire payload), not in GEM dialog looks.
Player names/teams are arrays sized to `PLAYER_MAX_COUNT`; solo uses index 0.
