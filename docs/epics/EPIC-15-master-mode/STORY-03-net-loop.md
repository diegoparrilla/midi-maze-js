---
id: STORY-03
epic: EPIC-15
title: Networked game loop integration
status: done
---

## Goal

Play a networked game from the lobby: drive the `NetGame` lock-step pump in the app,
rendered with the existing renderer, integrated into the game flow — so Host/Join is
a thing you click and then play.

## Tasks

- [x] Run `NetGame` as an async lock-step loop (gated by the ring), rendering the
      world each tick via the existing render path (3D view / HUD / map / dead view)
- [x] Flow: lobby → connecting → preview → networked play → game over → disconnect →
      lobby; Solo still uses the offline `step` loop
- [x] Local input via the EPIC-11 `Input`; quit injects `MIDI_TERMINATE_GAME`; on
      `terminated` / `timeout` / `winner`, tear down the transport and return to lobby
- [x] Status line reflects the net phase + a clear message on a dropped ring

## Acceptance

**Automated:** build/lint green (flow/loop logic leans on STORY-02 + EPIC-14 tests).
**Manual (user):** Host a game and play it against `orchestrator.py --ws`
(ring-of-one), indistinguishable from solo; the lobby returns cleanly on quit/drop.

## Notes

Two-browser play (and the live name exchange) is validated in EPIC-16. Here a
ring-of-one host is the end-to-end target; the join path is wired and unit-tested.
