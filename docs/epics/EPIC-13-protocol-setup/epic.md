---
id: EPIC-13
iteration: 4
title: Protocol: election, count, seed, send-data
status: done
---

## Goal

Master election (send 0x00; reply → master, timeout → slave: "the last machine that
closes the ring is master"), player count (0x80 + a 0x00), and the MIDI_SEND_DATA
(0x83) block: names, sizes/timings, 3 drone-count bytes, the 4096-byte maze grid,
team flags/assignments, friendly-fire, and the 2-byte RNG seed (the seed is part of
SEND_DATA, not a separate exchange).

## Stories

- STORY-01: Control bytes + `MIDI_SEND_DATA` codec — encode/decode the shared data
  block (names, maze-size, reload/regen/revive, lives, 3 drone counts, 4096 maze,
  team-flag, 16 teams, friendly-fire, 2-byte seed) ↔ `GameConfig`/maze/seed,
  byte-exact to `MIDICommunication.md`. Pure, unit-tested (round-trip + field order).
- STORY-02: Election + COUNT-PLAYERS state machine — Host emits `0x00` once → master
  (self-echo / round the ring); Join → slave on receiving `0x00`; `0x80 0x00`
  COUNT-PLAYERS tally → `machines_online`, `own_number`. Drives over a byte stream
  (D-11 Host/Join, C-04 no storm); tested with a loopback channel.
- STORY-03: Setup exchange — `runSetup(transport, role, config)` ties election →
  count → `START_GAME (0x84)` → `SEND_DATA (0x83)` (names accumulate round the ring)
  into a shared `{config, maze, seed, ownNumber, machinesOnline}` on master and
  slave. Integration-tested against a live `orchestrator.py --ws` ring-of-one.

## Notes

See ITERATIONS.md and `README/MIDICommunication.md` in the source for the
authoritative protocol. **Election resolved (D-11, spike):** the orchestrator is a
dumb relay and won't pick a master — it self-echoes a ring of one and otherwise lets
election emerge from ring routing. We drive it deterministically with Host/Join roles
(D-05) and implement the faithful state machine (emit `0x00` *once*; slave on
*receiving* `0x00`; master = `COUNT-PLAYERS` originator). Avoid the election storm and
freeze membership at START (C-04).
