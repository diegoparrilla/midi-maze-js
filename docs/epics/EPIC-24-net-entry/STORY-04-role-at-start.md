---
id: STORY-04
epic: EPIC-24
title: Role by master election (faithful)
status: done
---

## Goal

The master/slave role is **not** chosen by a button — it is decided the way the Atari ST
original does it (`dispatch.c` `DISPATCH_AUTOMATIC`): on entering the ring the node sends
a single MASTER message (`0x00`) and reads the result. If it comes back (echoed round the
ring / self-echoed by a ring of one) the node is **master**; if it is absorbed (a master
already owns the ring and does not echo) or times out, the node is a **slave**.

## Tasks

- [x] `electMaster(ch)` in `ring.ts`: flush, emit `0x00` once, read one byte —
      `own_number == 0` → host, else/timeout → join. Single-shot (no storm, C-04).
- [x] Invariant that makes it robust: slaves echo `0x00` (`waitForControl`), the master
      does **not** (its idle channel absorbs joiners' `0x00`), so node 0 swallows a
      late joiner's election and it falls through to slave. Master flushes before COUNT
      (`master.c:212`).
- [x] After `connectIdle` opens, `enterNetwork()` runs the election: **master** → the
      **ready** screen (press P / ▶ → preferences → Start drives COUNT/SEND-DATA/START —
      the preferences never auto-open, matching the master menu); **slave** → "waiting for
      the host" screen, then the patient join handshake → game. No Host/Join buttons.
- [x] The **master** is announced by a short modal ("This is the MASTER machine.", the
      original's `form_alert`); the **slave** needs none — its waiting screen reads "You
      are a SLAVE." Persistent labels: ready titled `MASTER`, slave screen `SLAVE`,
      in-game status prefixes `MASTER ·` / `SLAVE ·`.
- [x] Slave wait is patient (`SLAVE_WAIT_MS`), no Cancel button — it simply waits for the
      master; `Esc` is the quiet disconnect (`ByteChannel.abort`). Host setup is tight.
- [x] The lock-step game paces to the display refresh (one tick per `requestAnimationFrame`,
      like the solo loop) — without it the ring runs flat-out over a fast local link.
- [x] Start-map preview is a fixed **5 s** (`PREVIEW_MS`, wall-clock), matching the
      original's "5s delay … to see the map" (`maingame.c:218`, 300 Vsync).
- [x] A game over **never returns to the Solo/Network menu**: after a brief result it
      loops back to the role's idle state — master → ready (modal, host again), slave →
      re-armed wait (`runSetup` flushes residue per `slave.c:30`). The link is kept (it
      auto-reconnects); only an explicit `Esc` disconnects to the mode menu.
- [x] Membership freezes at START (C-04): the master's COUNT fixes the ring.

## Acceptance

**Automated:** `electMaster` unit-tested — self-echo → host (one `0x00` sent), absorbed
/ timeout → join, non-zero return → join. `session.test.ts` covers connect → handshake.
**Manual (user):** two browsers, same room — the first becomes master (lobby), the second
auto-becomes a slave (waiting), and they reach a synchronized game when the host starts.

## Notes

Supersedes the earlier Host/Join two-button design (and D-11a) — see DECISIONS **D-15**.
The networking primitives (COUNT/SEND-DATA, `NetGame`) are unchanged; only role *entry*
moves from a button to the faithful election.
