---
id: STORY-03
epic: EPIC-11
title: Fullscreen & gesture suppression
status: done
---

## Goal

Let the player go fullscreen, and stop the browser's own gestures from interfering
with play.

## Tasks

- [x] Fullscreen toggle (button + key) via the Fullscreen API, with graceful
      fallback when unavailable
- [x] Suppress page scroll / pinch-zoom / double-tap-zoom over the play area
      (`touch-action`, gesture/`wheel` handling, viewport meta already set)

## Acceptance

**Automated:** build/lint green.
**Manual (user):** fullscreen toggles on phone + desktop; the page doesn't scroll or
zoom while playing.

## Notes

Fullscreen also helps the Android orientation lock (STORY-02) take effect.
