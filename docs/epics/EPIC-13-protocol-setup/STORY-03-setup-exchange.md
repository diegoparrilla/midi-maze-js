---
id: STORY-03
epic: EPIC-13
title: Setup exchange (end-to-end handshake)
status: done
---

## Goal

Tie the pieces into one pre-game handshake over the transport: from election to a
shared world on every node — the reusable function EPIC-15 (master mode) drives.

## Tasks

- [x] `runSetup(transport, role, config)`: election (STORY-02) → COUNT-PLAYERS →
      `START_GAME (0x84)` → `SEND_DATA (0x83)` block (STORY-01) → resolve to
      `{ config, maze, seed, ownNumber, machinesOnline }` on master and slave
- [x] Master generates the 2-byte seed and authors the block; slaves adopt it;
      player names accumulate round the ring (each node contributes its own)
- [x] Lock-step send/receive pairing over the async `Transport` stream; bounded by
      the protocol timeout model (C-01) — surface a clean failure on timeout/drop
- [x] Integration test against a live `orchestrator.py --ws` ring-of-one: a single
      browser elects itself, counts 1, sends the block to itself, decodes it back,
      and yields a usable world + seed

## Acceptance

**Automated:** ring-of-one setup verified against a spawned orchestrator (Node's
built-in `WebSocket`, like the EPIC-12 integration check).
**Manual (user):** with `orchestrator.py --ws`, a browser reaches "ready to play"
(world built from the shared block).

## Notes

This is the protocol layer only — it produces the shared config/world/seed. Wiring
it to the lobby UI as the host is EPIC-15; the per-tick joystick ring loop is
EPIC-14. The seed is the last field of the `SEND_DATA` block (D-02 determinism).
