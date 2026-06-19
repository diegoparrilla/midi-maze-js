---
id: EPIC-13
iteration: 4
title: Protocol: election, count, seed, send-data
status: todo
---

## Goal

Master election (send 0x00; reply → master, timeout → slave: "the last machine that
closes the ring is master"), player count (0x80 + a 0x00), and the MIDI_SEND_DATA
(0x83) block: names, sizes/timings, 3 drone-count bytes, the 4096-byte maze grid,
team flags/assignments, friendly-fire, and the 2-byte RNG seed (the seed is part of
SEND_DATA, not a separate exchange).

## Stories

Authored at the start of iteration 4 (just-in-time, per ITERATIONS.md).

## Notes

See ITERATIONS.md and `README/MIDICommunication.md` in the source for the
authoritative protocol. **Election resolved (D-11, spike):** the orchestrator is a
dumb relay and won't pick a master — it self-echoes a ring of one and otherwise lets
election emerge from ring routing. We drive it deterministically with Host/Join roles
(D-05) and implement the faithful state machine (emit `0x00` *once*; slave on
*receiving* `0x00`; master = `COUNT-PLAYERS` originator). Avoid the election storm and
freeze membership at START (C-04).
