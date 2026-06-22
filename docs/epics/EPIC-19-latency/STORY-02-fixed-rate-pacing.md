---
id: STORY-02
epic: EPIC-19
title: Fixed-rate pump pacing
status: done
---

## Goal

Decouple the sim tick rate from the display refresh rate. The original advanced one tick
per VBL (~50/60 Hz); the browser loop ran one tick per `requestAnimationFrame`, so on a
120 Hz panel the game ran ~2× fast — doubling a browser-only ring's tick bandwidth and
halving the wall-clock-calibrated flow timers (preview/gameover) and the EPIC-22 end
animation. (In a mixed ring with a real ST the lock-step self-paces to the ST, so this is
mainly browser-only/solo, but it's a correctness fix either way.)

## Tasks

- [x] `game/pacer.ts` `FixedTimestep`: accumulate real elapsed time, yield how many fixed
      `TICK_HZ` (60) ticks to run this frame, with a catch-up cap that drops the backlog
      after a long stall (backgrounded tab). Pure + unit-tested.
- [x] Solo loop: step `advance(now)` times per frame (render every frame); reset the pacer
      on a new solo game.
- [x] Net loop: pace each tick to `TICK_INTERVAL_MS` (wait only the remainder; a slow ring
      already exceeds it, so no added latency) instead of raw `requestAnimationFrame`.
- [x] Gameover loop: fixed-interval delay so the ~3 s end animation is refresh-independent.

## Acceptance

**Automated:** `FixedTimestep` unit-tested (one tick/interval, catch-up cap, remainder
carry, reset); build/lint green. **Manual (user):** on a 120 Hz display the game runs at
the same speed as 60 Hz; the 5 s preview and 3 s end screen last the right time.

## Notes

The start-map preview already used a wall-clock loop, so it was already refresh-independent.
Closes EPIC-19.
