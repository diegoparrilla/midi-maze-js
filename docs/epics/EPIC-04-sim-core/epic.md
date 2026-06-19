---
id: EPIC-04
iteration: 2
title: Deterministic simulation core
status: done
---

## Goal

Fixed-point player/shot model, movement, wall/player collision, shooting, kills, and the shared RNG — golden-tested bit-for-bit against the original C (D-02, D-09, C-02).

## Stories

- STORY-01: Determinism primitives — fixed-point `muls_divs`, fast trig + sine
  table, shared RNG, `xy_speed_table`; plus the C golden harness (the EPIC-03
  deferral lands here).
- STORY-02: Player & shot state model + initialisation (`PLAYER_DATA`,
  `init_all_player`, `hunt_ply_pos` via the shared RNG).
- STORY-03: Movement — `move_player` turn/forward, wall + player collision.
- STORY-04: Shooting, hits, kills, scoring, respawn/regeneration.
- STORY-05: Golden trace integration — full `move_player`/shot traces vs the C
  harness, and a per-tick `step()` wired from `player_joy_table`.

## Notes

The C golden harness (`scripts/cref/`, `npm run cref`) copies the small,
self-contained logic verbatim and compiles it with the system `cc`, so real C
`short`/`int`/`long` semantics generate the reference vectors — catching any JS
signedness/truncation divergence (C-02). The original game compiles only as an
Xcode app, so we carve out the pure logic rather than reuse that target. See
`docs/reference/golden-master.md` and the C under `../../../AtariST-MIDIMaze-Source/`.
