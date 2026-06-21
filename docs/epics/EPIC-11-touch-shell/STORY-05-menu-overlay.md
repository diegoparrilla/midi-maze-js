---
id: STORY-05
epic: EPIC-11
title: Menu button & overlay
status: done
---

## Goal

A MENU button (in the right control zone) that opens a small in-game overlay with
the handful of actions a touch player needs, until the full menus epic.

## Tasks

- [x] MENU button opens/closes a lightweight overlay (pauses input underneath)
- [x] Overlay actions: toggle 2D map, toggle fullscreen, restart game
- [x] Dismiss on action or tap-outside; reachable by keyboard too

## Acceptance

**Automated:** build/lint green.
**Manual (user):** MENU opens the overlay; map/fullscreen/restart work from it.

## Notes

Intentionally minimal — the real title/options menus arrive in EPIC-20. Reuses the
existing map toggle, the STORY-03 fullscreen toggle, and the EPIC-09 restart.
