---
id: STORY-01
epic: EPIC-16
title: Browser-vs-browser lock-step validation
status: done
---

## Goal

Prove end-to-end that multiple browser nodes stay in perfect lock-step — zero desync —
through the orchestrator ring (C-02). Setup agreement (election, count, names, data block,
seed) is already covered by `handshake.test.ts`; this covers the **gameplay** loop and the
TERMINATE end.

## Tasks

- [x] An N-node ring harness (`ringN`, `OUT(N) → IN(N+1)`) and `playInLockStep`: build one
      `World` per node from the same seed/config (identical placement), drive a `NetGame`
      per node over the ring, and after every tick assert all nodes' `worldChecksum`
      (EPIC-18) and observed joystick ring are identical.
- [x] Two-browser full exchange (60 ticks, movement + fire) stays bit-identical.
- [x] Three-browser run (48 ticks) stays bit-identical — exercises ring routing for > 2.
- [x] Master quit ends both nodes cleanly via the TERMINATE two-step.

## Acceptance

**Automated:** the 2- and 3-node lock-step runs and the TERMINATE end are unit-tested
(`netplay.test.ts`); build/lint green. **Manual (user):** two browser tabs/phones play a
full game through the live orchestrator and stay in sync (the D-overlay checksum matches
across screens).

## Notes

Reuses the EPIC-18 `worldChecksum` as the desync oracle and the EPIC-17 determinism
guarantees. The harness pins a short `timeoutMs` so a deadlock fails fast rather than
hanging on the adaptive ceiling. A real-orchestrator two-browser run is the remaining
manual check (the in-repo ring is a faithful relay model).
