---
id: STORY-02
epic: EPIC-15
title: Session connect + setup
status: done
---

## Goal

Turn a Host/Join choice into a ready networked world: connect the transport, run the
handshake in the chosen role, and resolve the shared game — all DOM-free so it is
testable.

## Tasks

- [x] `connectSession(net, config)`: open the EPIC-12 `Transport` (with `room`), wire
      a `ByteChannel` to its byte stream, await `open`, then `runSetup(role, config,
      seed)` (host authors the seed) → `{ transport, channel, setup }`
- [x] Status surface: `connecting` → `waiting` (handshake) → `ready` / `error`, with a
      clean failure on connect/timeout (the ring "boo-boo")
- [x] Host freezes membership at START (C-04): the handshake runs once, after the
      lobby is settled — no joins mid-COUNT
- [x] Tests: host ring-of-one via a loopback/self-echo channel resolves a world;
      error path on a dead channel

## Acceptance

**Automated:** `connectSession` host path covered by Vitest (loopback); plus the
existing on-demand orchestrator check from EPIC-13.
**Manual (user):** picking Host + Start reaches "ready" against `orchestrator.py --ws`.

## Notes

Builds the world from the `runSetup` result (config, maze, seed, ownNumber,
machinesOnline) the same way `newWorld` does for solo. Reuses EPIC-12/13/14 modules.
