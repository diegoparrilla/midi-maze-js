---
id: STORY-03
epic: EPIC-14
title: Determinism over the wire
status: done
---

## Goal

Prove the lock-step loop stays bit-identical across the transport (D-02 / C-02): a
networked game and a purely-local sim, given the same seed/config/joystick stream,
reach the same world state every tick.

## Tasks

- [x] Integration: against a live `orchestrator.py --ws` ring-of-one, run `runSetup`
      then the pump for N ticks driving a scripted joystick sequence
- [x] Run the identical seed/config/joystick through a local-only sim (no transport)
- [x] Assert the two world states match tick-by-tick (positions, scores, shots)
- [x] Cover a few seeds + joystick patterns (incl. firing / hits)

## Acceptance

**Automated:** wire-vs-local determinism verified against a spawned orchestrator
(on-demand, like the EPIC-12/13 integration checks — not in CI).
**Manual (user):** a ring-of-one networked game is indistinguishable from solo.

## Notes

Ring-of-one self-echo makes the node both sender and receiver, so the joystick it
sends comes back as its own input — a clean determinism harness without a second
node. True multi-node determinism is EPIC-16.
