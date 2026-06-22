---
id: EPIC-21
iteration: 6
title: Sound
status: done
---

## Goal

Shot and hit sounds. These are NOT in the .D8A data — the original synthesises them
on the YM2149 chip (sound.c). Reproduce via WebAudio (synthesised) or recreated SFX.

## Stories

- STORY-01: Shot & hit SFX — a small PSG renderer interprets the original `sound.c`
  `Dosound` packets into AudioBuffers, played on the matching tick (fire / get-hit /
  land-hit). Sound is local-only, outside the deterministic sim.

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
