---
id: STORY-02
epic: EPIC-13
title: Election + COUNT-PLAYERS state machine
status: done
---

## Goal

The pre-game handshake that decides master/slave and counts the ring, faithful to
the MIDI protocol but driven deterministically by explicit Host/Join roles (D-11).

## Tasks

- [x] Election: Host emits `0x00` once and becomes master when it returns (self-echo
      in a ring of one, else round the ring); Join becomes slave on *receiving*
      `0x00` and forwards it. Never emit `0x00` repeatedly (C-04, no storm).
- [x] COUNT-PLAYERS: master sends `0x80 0x00`; each slave increments the count byte;
      the returned tally yields `machines_online`; assign `own_number` by ring order.
- [x] Model it as a small async state machine consuming a byte stream (the EPIC-12
      `Transport`), pairing send/receive like the C's `Bconout`/`get_midi`.
- [x] Unit tests with a loopback byte channel: ring-of-one Host elects itself,
      counts 1; a Join adopts slave on `0x00`.

## Acceptance

**Automated:** election + count covered by Vitest with a fake/loopback channel.
**Manual (user):** none here (live ring is STORY-03).

## Notes

Master identity = the originator of COUNT-PLAYERS (the orchestrator badges it). The
exact count arithmetic (`machines_online`, `own_number`) is pinned against the
orchestrator/source. Ties to D-11, C-04.
