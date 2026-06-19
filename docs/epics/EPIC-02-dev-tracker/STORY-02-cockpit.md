---
id: STORY-02
epic: EPIC-02
title: Cockpit dashboard generator
status: done
---

## Goal

A dependency-free script that rolls up task checkboxes into `STATUS.md`.

## Tasks

- [x] `cockpit.sh` reads epics/stories, counts checkboxes, groups by iteration
- [x] Progress bars per epic and overall
- [x] Generate the first `STATUS.md` and confirm numbers look right
- [x] Note in `README.md` that `STATUS.md` is generated

## Acceptance

**Automated:** `./docs/epics/cockpit.sh --stdout` runs without error and totals
match the checkboxes.
**Manual (user):** `STATUS.md` reads as an accurate dashboard.

## Notes

Bash + grep/sed only, matching the md-MIDI2IP approach (no deps).
