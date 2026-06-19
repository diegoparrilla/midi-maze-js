---
id: EPIC-15
iteration: 4
title: Browser master mode
status: todo
---

## Goal

An explicit **Host** role: a browser that elects itself master and drives the setup
handshake (menus / maze-select / name / COUNT-PLAYERS → SEND-DATA → START-GAME), with
**Join** browsers following as slaves (master.c, slave.c, D-05, D-11).

## Stories

Authored at the start of iteration 4 (just-in-time, per ITERATIONS.md).

## Notes

Election design is settled in D-11 (spike): the orchestrator does NOT pick a master,
so the Host UI choice is what makes it deterministic. The host must gate the handshake
behind a settled lobby and freeze membership at START (C-04) — joins mid-COUNT break
the count. Master identity on the wire = whoever originates `COUNT-PLAYERS` (0x80).
See `../../../AtariST-MIDIMaze-Source/` and `md-MIDI2IP/.../ORCHESTRATOR-CONTRACT.md`.
