---
id: STORY-02
epic: EPIC-23
title: Graceful mid-game drop / reconnect
status: done
---

## Goal

When a node drops mid-game the lock-step ring times out (C-01). Don't present that as a
bogus "game over" with no winner — surface the drop, then recover to the idle state for
the next game.

## Tasks

- [x] On a `'timeout'` end, skip the win/lose end animation: show `connection lost —
      reconnecting…`, clear the stale 3D view, brief pause, then fall through to the normal
      return-to-idle path (master → ready, slave → re-armed wait).
- [x] Rely on the held idle link's existing auto-reconnect (capped backoff) + the
      net-status icon (red/blink on drop) for the recovery itself.

## Acceptance

**Automated:** the underlying `NetGame` `'timeout'` end is already unit-tested
(`netgame.test.ts`, `netplay.test.ts`); build/lint green. **Manual (user):** kill one
node mid-game — the others show "connection lost", the status icon blinks red, and they
return to ready/waiting and can start the next game once the link recovers.

## Notes

Resuming a *specific* in-progress game after a drop isn't faithful (the original just drops
you) and isn't attempted; recovery is "back to idle, ready for the next game". The
transport reconnect + status icon already existed (EPIC-12/EPIC-24); this story is the
in-game UX that ties them together.
