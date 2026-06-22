---
id: STORY-02
epic: EPIC-24
title: Connect screen + persistent idle link
status: done
---

## Goal

After choosing Network, a GEM screen for **Server** + **Room**; **Connect** opens the
`Transport` and holds it open *idle* — connected, reconnecting on drop, but sending no
handshake/game bytes until the player picks a role at Start (STORY-04).

## Tasks

- [x] Connect screen: Server (`url`, ws/wss) + Room fields, validated (reuse
      `isValidNet`); Connect / Back actions
- [x] Split `session.ts`: a `connectIdle(net, opts)` that opens the `Transport`
      (`reconnect: true`, `room`), wires a `ByteChannel`, resolves on first `open`, and
      stays connected — **no `runSetup`**. Returns `{ transport, channel }` + a live
      status. Keep `connectSession` for the at-Start handshake, refactored to accept an
      already-open channel (STORY-04)
- [x] On Connect success → proceed to the config lobby with the link held open
- [x] Idle inbound bytes are buffered/ignored until the handshake arms (no game traffic
      before START)

## Acceptance

**Automated:** `connectIdle` unit-tested with the `FakeEchoSocket` — resolves on open,
exposes status, survives with no handshake; `reconnect` path covered.
**Manual (user):** Connect to the live orchestrator; the link reports connected and
stays up with no game running.

## Notes

Matches the original: nodes are on the ring before the master runs COUNT/SEND-DATA/
START. The idle channel is the same `ByteChannel`; `runSetup` simply arms later over
it. Holds one connection across the lobby — no reconnect churn at Start.
