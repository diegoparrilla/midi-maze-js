---
id: EPIC-25
iteration: 7
title: User manual & documentation
status: done
---

## Goal

A README that doubles as the user manual: how to build it, how to deploy a built bundle,
and a screenshot-illustrated walkthrough of the whole player experience (menus → lobby →
play → map/menu/debug). Screenshots are captured from the real built app, reproducibly.

## Stories

- STORY-01: Build & deploy basics in the README — commands to build/run, and generic
  static-host deployment notes (incl. the HTTP-vs-HTTPS constraint for `ws://` orchestrators).
- STORY-02: User-experience walkthrough — a step-by-step "How to play" with an embedded
  screenshot per screen + a controls table.
- STORY-03: Screenshot capture tooling — `scripts/shots.mjs` (`npm run shots`) drives the
  solo flow in a real browser (system Chrome via `playwright-core`) and writes
  `docs/images/*.png`, so the docs images can be regenerated when the UI changes.

## Notes

The capture script drives Solo (no orchestrator needed). The first-person frame rotates
until a corridor is in view (the solo seed increments each round, so spawn/orientation
vary). The win/lose end screen isn't auto-captured — a natural 10-kill round end is
nondeterministic and slow in solo — so it's described in prose instead.
