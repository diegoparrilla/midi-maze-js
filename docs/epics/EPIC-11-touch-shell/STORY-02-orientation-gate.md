---
id: STORY-02
epic: EPIC-11
title: Orientation gate & landscape lock
status: done
---

## Goal

Phones and tablets always play in landscape: gate the game on orientation as one of
the first startup checks, and lock to landscape where the platform allows.

## Tasks

- [x] Portrait "rotate your device to landscape" overlay, shown as one of the first
      things at startup on touch / coarse-pointer devices; it holds the game until
      landscape is detected
- [x] Best-effort `screen.orientation.lock('landscape')` where supported (Android,
      typically in fullscreen); the overlay is the fallback where it can't (iOS)
- [x] Show/hide the overlay on `orientationchange` / resize

## Acceptance

**Automated:** build/lint green.
**Manual (user):** held in portrait a phone/tablet shows the rotate overlay and the
game waits; rotating to landscape dismisses it and play begins.

## Notes

Orientation lock is best-effort (works in fullscreen on Android; iOS Safari can't
lock — the overlay is the guarantee there). Desktop is unaffected.
