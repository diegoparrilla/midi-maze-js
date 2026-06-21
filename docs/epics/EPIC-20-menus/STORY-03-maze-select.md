---
id: STORY-03
epic: EPIC-20
title: Maze selection
status: done
---

## Goal

Let the lobby choose which maze to play from the vendored set, and load it into the
game (the browser stand-in for `master.c`'s maze file selector).

## Tasks

- [x] Enumerate the vendored mazes (`bigstart`, `hudson`, `midimaze`) as selectable
      options with the chosen one stored as `config.mazeId`
- [x] Load the selected maze JSON into the `World` at game start
- [x] Default selection = `midimaze`; selection persists across restarts in a session

## Acceptance

**Automated:** build/lint green; maze-id → loader mapping unit-tested.
**Manual (user):** picking a different maze in the lobby starts that maze.

## Notes

A maze registry maps `mazeId` → asset import. Uploading custom `.MAZ` files is out of
scope here (later, if wanted); these are the assets extracted in EPIC-03.
