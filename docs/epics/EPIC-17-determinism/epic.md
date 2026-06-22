---
id: EPIC-17
iteration: 5
title: Determinism hardening & desync detection
status: in-progress
---

## Goal

Fuzz the sim against reference vectors; detect and diagnose divergence; lock down fixed-point edge cases (C-02).

## Stories

- STORY-01: Fuzz the full-tick sim vs the C reference — 16 randomized `run_match` cases
  (1–8 players, 40–64 ticks) replayed bit-for-bit, plus a `firstDivergence` locator that
  pinpoints the exact (tick, player, field) on a mismatch. `done`.
- STORY-02 (todo): Fixed-point edge-case lockdown — targeted vectors for the integer
  hazards (`muls_divs` 32-bit intermediate, angle wrap, long-run RNG, near-edge
  shot/position) the random fuzz may not hit reliably.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
