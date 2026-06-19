---
id: STORY-05
epic: EPIC-04
title: Per-tick step() + full golden trace integration
status: todo
---

## Goal

A single deterministic `step(joyTable)` that advances the whole world one tick
(all players + shots), wired the way `maingame.c` drives `move_player`, validated
against an end-to-end C trace.

## Tasks

- [ ] `step(joyTable)`: apply moves for every player/drone slot in order
- [ ] Multi-player, multi-tick golden trace (several players, shots, a kill) vs C
- [ ] Document the determinism contract for the network layer (EPIC-14)

## Acceptance

**Automated:** an end-to-end multi-player trace matches the C harness bit-for-bit
over many ticks.
**Manual (user):** none.

## Notes

This is the deterministic core the network layer feeds joystick bytes into. Drones
(EPIC-08) plug in as extra slots driving `player_joy_table[]`.
