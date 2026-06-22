---
id: STORY-01
epic: EPIC-24
title: Mode menu (Solo / Network)
status: done
---

## Goal

A first-thing entry menu that asks how to play — **Solo** or **Network** — instead of
a Mode row inside the config lobby. Reachable again from the in-game menu.

## Tasks

- [x] GEM-styled Mode menu shown on load: `Solo` and `Network` choices
- [x] Solo → the **ready** screen (press P / ▶ to open preferences — the original never
      auto-opens the config dialog); Network → the connect screen (STORY-02)
- [x] Ready screen: main screen + a `▶ PLAY` button (where the touch map button sits) and
      the `P` key; `Esc`/▶-back returns to the mode menu (tearing down any net link)
- [x] Reachable from the in-game menu (a "Main menu" action) and from game-over →
      returns to the ready screen (solo) / mode menu (net), tearing down any net session

## Acceptance

**Automated:** build/lint green; any pure routing helper unit-tested.
**Manual (user):** the app opens on the Mode menu; Solo and Network route correctly;
the in-game menu can return here.

## Notes

Removes the Mode row from the lobby (EPIC-15); the lobby becomes purely game config.
A small flow/route state (`mode | connect | ready | lobby | waiting`) drives which screen
is visible. The **ready** screen replaces the original master's "sit in the menu until
MAZE → Play" with a `P` / `▶` gate so the preferences never auto-open (D-15).
