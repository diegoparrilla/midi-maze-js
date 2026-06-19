---
id: STORY-04
epic: EPIC-04
title: Shooting, hits, kills, scoring, respawn
status: done
---

## Goal

The combat half of `gamelogi.c`: firing, shot motion (3× speed), hit detection,
team/friendly-fire rules, scoring, death, regeneration/respawn.

## Tasks

- [x] Fire on button + reload==0; shot spawns at player, inherits direction (`movePlayer`)
- [x] Shot motion 3 substeps/tick; wall stop; player-hit detection (`moveShoot`)
- [x] Damage/kill, `ply_score`, team + friendly-fire rules, win at `GAME_WIN_SCORE`
- [x] Regeneration/respawn timers + `hunt_ply_pos` respawn (refresh block in `movePlayer`)
- [x] Golden traces vs the C harness: shoot-wall, shoot-hit, kill-respawn (RNG-driven
      respawn position) — `src/sim/combat.test.ts`; game config on `World`

## Acceptance

**Automated:** shot path, hit tick, and resulting scores match the C harness.
**Manual (user):** none.

## Notes

Respawn uses the shared RNG (STORY-01/02). Depends on STORY-03.
