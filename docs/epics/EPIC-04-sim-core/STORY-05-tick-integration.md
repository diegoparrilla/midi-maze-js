---
id: STORY-05
epic: EPIC-04
title: Per-tick step() + full golden trace integration
status: done
---

## Goal

A single deterministic `step(joyTable)` that advances the whole world one tick
(all players + shots), wired the way `maingame.c` drives `move_player`, validated
against an end-to-end C trace.

## Tasks

- [x] `step(joyTable)` (`src/sim/step.ts`): rebuild object map, reset hit flags,
      move every slot from the rotating `playerIndex` with the winner early-break
- [x] Multi-player, multi-tick golden trace (3 players, 16 ticks, fire+moves) vs the
      C `maingame` tick runner — `src/sim/step.test.ts`
- [x] Determinism contract for the network layer documented (`docs/reference/golden-master.md`)

## Acceptance

**Automated:** an end-to-end multi-player trace matches the C harness bit-for-bit
over many ticks.
**Manual (user):** none.

## Notes

This is the deterministic core the network layer feeds joystick bytes into. Drones
(EPIC-08) plug in as extra slots driving `player_joy_table[]`.
