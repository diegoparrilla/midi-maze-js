---
id: EPIC-24
iteration: 4
title: Network entry flow & connection status
status: done
---

## Goal

Restructure the entry experience: a **Mode menu** (Solo / Network) on load (and from
the in-game menu); for Network, a **Server + Room** screen that opens a *persistent,
idle* WebSocket (connected, no game traffic yet) with a small **net-status icon** by
the fullscreen icon (red + blink on drop). The **master/slave role is decided by a
faithful election** (a `0x00` MASTER message round the ring, `dispatch.c`) — not a
button: first into the ring hosts, everyone else waits as a slave and is pulled into the
game when the host starts.

The preferences dialog **never auto-opens** (the original master sits in its menu until
the player picks MAZE → Play): after Mode/Connect the app shows a **ready** main screen
and waits for **P / ▶**. Solo and the elected master open the preferences from there;
a slave skips it and waits for the host.

## Stories

- STORY-01: Mode menu — a Solo / Network entry screen shown on load and reachable
  from the in-game menu; routes to the ready screen (solo) or the network connect screen.
- STORY-02: Connect screen + persistent idle link — Server/Room fields → Connect opens
  the `Transport` and keeps it open (idle), reconnecting on drop; exposes the live
  connection state. No handshake/game bytes until Start.
- STORY-03: Net-status indicator — a small icon next to the fullscreen button showing
  connecting / connected / dropped; turns red and blinks when the link drops.
- STORY-04: Role by election — `electMaster` sends `0x00` once and reads the result to
  pick master vs slave (`dispatch.c`); master → ready screen (press P → preferences →
  Start), slave → waiting screen → game. Runs `runSetup` over the already-open channel,
  then `NetGame` (reusing EPIC-13/14/15 modules). Supersedes the Host/Join buttons (D-15).

- Connect errors are room-aware: an orchestrator room refusal (HTTP 403, indistinguishable
  from an unreachable server to a browser) closes before opening → a hedged
  "room … was refused — check it exists" message.

## Notes

Supersedes EPIC-15's in-lobby Mode row + connect-on-Start: the networking *modules*
(transport / protocol / ring / setup / netgame / session) are unchanged; this only
restructures the UI/flow. Connecting early (idle) matches the original — nodes join
the ring first, then the master triggers COUNT/SEND-DATA/START; membership freezes at
START (C-04, D-11). See `../../../AtariST-MIDIMaze-Source/` (master.c / slave.c).
