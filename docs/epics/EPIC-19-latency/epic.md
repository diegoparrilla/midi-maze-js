---
id: EPIC-19
iteration: 5
title: Latency/timeout tuning
status: done
---

## Goal

Tune the lock-step pump for internet latency without breaking the MIDI timeout model (readmidi.c, EPIC-09 ring-queue learnings).

## Stories

- STORY-01: Adaptive lock-step timeout — the per-tick read deadline adapts to measured RTT
  (EWMA, clamped to a band), centralized + URL-tunable; the timeout model (missing byte →
  end) is unchanged. `done`.
- STORY-02: Fixed-rate pump pacing — decouple the sim tick rate from display refresh
  (`FixedTimestep` at 60 Hz) so high-refresh panels don't run the game ~2× fast. `done`.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
