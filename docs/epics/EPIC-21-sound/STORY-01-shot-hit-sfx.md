---
id: STORY-01
epic: EPIC-21
title: Shot & hit SFX (PSG-rendered from sound.c)
status: done
---

## Goal

The two MIDI Maze sounds — a **shot** (when the local player fires) and a **hit** (when
the local player is hit or lands a hit) — reproduced from the original `sound.c`
`Dosound` packets. A small YM2149/PSG renderer interprets the actual `sound_shot` /
`sound_hit` register tables into short PCM buffers at init; the game plays them on the
matching tick. Sound is local-only (it never crosses the wire), so this is presentation
polish, not part of the deterministic sim.

## Tasks

- [x] PSG renderer (`sound/psg.ts`): interpret a `Dosound` packet (reg-load opcodes
      `0x00–0x0F` + the `0x82,count` wait/terminate opcode) into a mono `Float32Array`.
      Square tone (period → freq), 17-bit LFSR noise, AY mixer (`R7`), per-channel
      amplitude, and a one-shot volume **envelope** tail for the hit (`R13` shape `\___`,
      `EP = R12<<8|R11`). Pure + unit-tested.
- [x] SFX packets + player (`sound/sfx.ts`): the `sound_shot` / `sound_hit` byte tables
      transcribed from `sound.c`; a lazy `AudioContext` that pre-renders both buffers and
      plays them. `unlock()` on a user gesture (autoplay policy); `playShot()`/`playHit()`.
- [x] Trigger detection (`sound/triggers.ts`): a pure `detectSfx(world, cameraIndex,
      prevReload)` — **shot** = camera player's reload rose from 0 (`gamelogi.c:126`);
      **hit** = camera player's `ply_hitflag` set, or a player it shot got hit this tick
      (`gamelogi.c:347`, `maingame.c:236`). Unit-tested.
- [x] Wire into both game loops (solo `step` + net `runTick`) and unlock on Play/Start/P.

## Acceptance

**Automated:** the PSG renderer and trigger detector are unit-tested; build/lint green.
**Manual (user):** firing plays the descending zap; getting hit / landing a kill plays
the noise thud; no audio before the first gesture; no regressions in the lock-step sim.

## Notes

`Dosound` packet format: opcodes `0x00–0x0F` write the next byte to that PSG register;
an opcode `>= 0x80` (only `0x82` appears here) reads a frame count — `0` terminates.
The hit packet terminates immediately and relies on the hardware envelope continuing,
so the renderer emits the envelope decay as a tail. ST YM2149 clock = 2 MHz; the
`sound.c` envelope-period comment labels High/Low backwards (`EP = R12<<8|R11 = 4096` →
~0.52 s decay). Faithful to the data, not a cycle-exact chip emulation.
