---
id: STORY-01
epic: EPIC-14
title: Joystick ring exchange (one tick)
status: done
---

## Goal

One tick of the lock-step joystick ring (`maingame.c:415-422`) over the async
`ByteChannel`: contribute our own joystick byte and receive every other human
player's byte, faithful to the ring order/direction, so each node ends the exchange
with the identical joystick table for that tick (D-02).

## Tasks

- [x] `exchangeJoysticks(ch, ownNumber, machinesOnline, ownByte)` → joystick bytes
      for `[0, machinesOnline)`, mirroring the C send/receive ring (send own, step
      the index, read the next player's byte, until back to `own_number`)
- [x] Tight per-tick timeout (the ring's unforgiving model, C-01) → reject/throw on a
      missed byte so the pump can end cleanly
- [x] Unit tests with a loopback channel: ring of one returns our byte into our own
      slot; a scripted 2-player exchange fills both slots in order

## Acceptance

**Automated:** exchange covered by Vitest with a loopback/scripted channel.
**Manual (user):** none here (a live game is STORY-03).

## Notes

Only the `machinesOnline` human slots are exchanged; drone slots are filled locally
by `step()`'s `drone_action` (every node computes drones identically). The exact own
slot + ring direction are pinned against `maingame.c` and the orchestrator.
