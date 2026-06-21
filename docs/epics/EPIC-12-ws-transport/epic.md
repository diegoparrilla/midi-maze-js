---
id: EPIC-12
iteration: 4
title: WebSocket transport client
status: done
---

## Goal

Binary-frame opaque byte pipe to the orchestrator; room join via Authorization: Bearer; reconnect (D-08).

## Stories

- STORY-01: WebSocket byte pipe — a `Transport` over the native browser `WebSocket`
  (binary frames, `arraybuffer`), `send(bytes)` + `onBytes` callback, status events.
  Socket creation is injectable so it is unit-tested with a fake socket.
- STORY-02: Reconnect & lifecycle — connect/disconnect, auto-reconnect with capped
  backoff, status transitions (`connecting`/`open`/`reconnecting`/`closed`).
- STORY-03: Room join — carry a room key to the orchestrator via a `?room=<key>`
  query param. The orchestrator now accepts that browser-usable channel (browsers
  can't set `Authorization` on a WebSocket); verified end-to-end against a live
  `orchestrator.py --ws`.

## Notes

The browser's native `WebSocket` does all RFC 6455 framing, so there is no codec to
port here (cf. the server-side `orchestrator/ws.py`) — only the carrier + lifecycle.
The byte stream itself is opaque and unchanged (D-02/D-08). See ITERATIONS.md for
where this epic sits.
