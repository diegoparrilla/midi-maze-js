---
id: STORY-03
epic: EPIC-24
title: Net-status indicator
status: done
---

## Goal

A small status icon beside the fullscreen button reflecting the idle link:
connecting / connected / dropped. On a drop it turns **red and blinks** until the link
recovers (or the player leaves network mode).

## Tasks

- [x] A compact dot/icon anchored next to `#fullscreen-btn`, only shown in network mode
- [x] Drive it from the `Transport` status (STORY-02): `connecting` (amber), `open`
      (green/steady), `closed`/reconnecting (red + blink)
- [x] CSS blink animation for the dropped state; hidden entirely in solo mode
- [x] Tooltip / `aria-label` reflecting the current state

## Acceptance

**Automated:** build/lint green; the status→class mapping unit-tested if extracted as a
pure helper.
**Manual (user):** the icon shows connected; killing the orchestrator turns it red and
blinking; restarting recovers it to green.

## Notes

Reads the same status stream the connect screen uses — no new connection. Placed by the
fullscreen button (`src/style.css` `#fullscreen-btn`), matching that control's metrics.
