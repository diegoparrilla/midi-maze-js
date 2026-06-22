---
id: STORY-03
epic: EPIC-25
title: Screenshot capture tooling
status: done
---

## Goal

Regenerate the README screenshots from the real built app, so the docs images stay current
without hand-capturing.

## Tasks

- [x] `scripts/shots.mjs` + `npm run shots`: drive the solo flow in system Chrome via
      `playwright-core` (no browser download) and write `docs/images/01..09-*.png`.
- [x] Robust first-person capture: rotate until the view shows sky (a real corridor) before
      shooting the frame — the solo seed increments each round, so spawn/orientation vary.
- [x] Capture the pre-game screens (mode/connect/ready/lobby/preview) and the in-game
      overlays (map/menu/debug) cleanly (debug captured with the menu closed).
- [x] `playwright-core` added as a devDependency.

## Acceptance

**Automated:** `npm run build && npm run preview` then `npm run shots` writes the nine PNGs
without error; build/lint green. **Manual:** the captured frames are correct (FPV shows a
corridor, not a wall; debug overlay isn't covered by the menu).

## Notes

The end screen is intentionally not auto-captured (a natural round end in solo is slow and
nondeterministic — the AI must re-hunt the respawned player across the maze each kill).
