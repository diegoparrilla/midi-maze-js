---
id: STORY-02
epic: EPIC-25
title: User-experience walkthrough with screenshots
status: done
---

## Goal

A "How to play" section that walks through the whole experience with a screenshot per
screen, plus a controls reference.

## Tasks

- [x] Step-by-step walkthrough: mode menu → (network) connect/rooms → ready (P) →
      preferences lobby → map preview → first-person play (HUD) → overhead map (M) →
      pause menu (Esc) → debug overlay (D), each with an embedded `docs/images/*.png`.
- [x] Describe the end-of-round win/lose animation (not screenshotted — see EPIC-25 notes).
- [x] Controls table (keyboard + touch): move/turn/fire, start, map, menu, fullscreen,
      debug, names.

## Acceptance

**Automated:** none (docs). **Manual:** the screenshots render in the README and match the
current UI; the walkthrough reads in play order.
