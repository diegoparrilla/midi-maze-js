---
id: EPIC-15
iteration: 4
title: Browser master mode
status: done
---

## Goal

An explicit **Host** role: a browser that elects itself master and drives the setup
handshake (menus / maze-select / name / COUNT-PLAYERS → SEND-DATA → START-GAME), with
**Join** browsers following as slaves (master.c, slave.c, D-05, D-11).

## Stories

- STORY-01: Lobby role & connection — a Solo / Host / Join selector plus server URL +
  room fields (shown for Host/Join), GEM-styled; a small `NetConfig` model
  (mode/url/room), unit-tested. Solo keeps the current offline path.
- STORY-02: Session connect + setup — on Start, open the `Transport`, wire a
  `ByteChannel`, run `runSetup` with the chosen role, and build the world from the
  result; surface connecting / waiting / error states and freeze membership at START
  (C-04). A DOM-free `connectSession(net, config)` → `{ transport, channel, setup }`.
- STORY-03: Networked game loop — drive `NetGame` in the app loop (async lock-step
  ticks, rendered via the existing renderer), integrated with `GameFlow`
  (lobby → connecting → preview → networked play → game over → disconnect → lobby);
  local quit injects `TERMINATE_GAME`; clean teardown on end/drop.

## Notes

Election design is settled in D-11 (spike): the orchestrator does NOT pick a master,
so the Host UI choice is what makes it deterministic. The host must gate the handshake
behind a settled lobby and freeze membership at START (C-04) — joins mid-COUNT break
the count. Master identity on the wire = whoever originates `COUNT-PLAYERS` (0x80).
See `../../../AtariST-MIDIMaze-Source/` and `md-MIDI2IP/.../ORCHESTRATOR-CONTRACT.md`.
