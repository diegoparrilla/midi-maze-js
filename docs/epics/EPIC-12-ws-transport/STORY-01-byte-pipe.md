---
id: STORY-01
epic: EPIC-12
title: WebSocket byte pipe
status: done
---

## Goal

An opaque binary byte pipe to the orchestrator over the browser's native
`WebSocket` — the carrier for the MIDI Maze stream (D-02/D-08). The byte stream is
unchanged; this only moves bytes in and out.

## Tasks

- [x] `Transport` class: open a `WebSocket` (`binaryType = 'arraybuffer'`),
      `send(bytes: Uint8Array)`, and an `onBytes(Uint8Array)` callback for inbound
      binary frames
- [x] Status callback (`idle`/`connecting`/`open`/`closed`) + `close()`
- [x] Inject the socket factory so the codec-free carrier is unit-testable with a
      fake socket (no real network in CI)
- [x] Unit tests: send forwards bytes; inbound frame fires `onBytes`; status events

## Acceptance

**Automated:** Transport send/receive/status covered by Vitest with a fake socket.
**Manual (user):** with `orchestrator.py --ws` running, the page connects and bytes
round-trip (smoke test).

## Notes

No RFC 6455 codec here — the browser handles framing. `ArrayBuffer` payloads are
normalised to `Uint8Array` for the caller.
