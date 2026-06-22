---
id: STORY-01
epic: EPIC-17
title: Fuzz the full-tick sim vs the C reference
status: done
---

## Goal

Guard against desync (C-02) by exercising the integer sim across **many random game
paths**, not just the handful of hand-authored scenarios. The `run_match` C harness +
`step.test.ts` already replay one full-game trace bit-for-bit; this generates a broad
spread of randomized matches and, when one fails, pinpoints the exact diverging
(tick, player, field).

## Tasks

- [x] Generate randomized `run_match` cases in `mmref.c`: 16 matches spanning 1–8 players
      over 40–64 ticks, with joysticks driven by a standalone LCG (so it never perturbs the
      sim's `_random_seed` for placement/respawn) weighted toward movement with a per-case
      fire rate. Seeds are fixed, so regeneration is byte-stable; the bytes are emitted so
      the TS side just replays them. Regenerate `golden/primitives.json` (`npm run cref`).
- [x] `firstDivergence` / `describeDivergence` (`sim/divergence.ts`): the first differing
      (tick, player, field, expected, actual) between two traces, or a length-mismatch
      report. Pure + unit-tested.
- [x] Use the locator in `step.test.ts` so a fuzz failure prints a one-line desync locator
      instead of a 64-tick × 8-player deep-diff dump.

## Acceptance

**Automated:** all 17 match cases (1 hand-authored + 16 fuzz) replay bit-for-bit through
the TS `step()`; `firstDivergence` is unit-tested; build/lint green.
**Manual:** none — this is a CI guard.

## Notes

The fuzz covers movement, wall/player collision, shooting, hit/kill/score, and the
RNG-driven respawn across random paths, all on human players (drones have their own golden
coverage in `drone.test.ts` / `run_drones`). Regenerating the golden needs `cc`; the
committed `primitives.json` is the artifact CI reads. Fixed-point edge-case lockdown
(targeted overflow/rounding/angle-wrap vectors) is STORY-02.
