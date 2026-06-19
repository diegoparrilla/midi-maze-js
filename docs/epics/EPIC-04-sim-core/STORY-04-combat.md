---
id: STORY-04
epic: EPIC-04
title: Shooting, hits, kills, scoring, respawn
status: todo
---

## Goal

The combat half of `gamelogi.c`: firing, shot motion (3× speed), hit detection,
team/friendly-fire rules, scoring, death, regeneration/respawn.

## Tasks

- [ ] Fire on button + reload==0; shot spawns at player, inherits direction
- [ ] Shot motion 3 substeps/tick; wall stop; player-hit detection (`PLAYER_RADIUS`)
- [ ] Damage/kill, `ply_score`, team + friendly-fire rules, win at `GAME_WIN_SCORE`
- [ ] Regeneration/respawn timers + `hunt_ply_pos` respawn
- [ ] Golden trace: a fired shot down a corridor → path + hit tick vs the C harness

## Acceptance

**Automated:** shot path, hit tick, and resulting scores match the C harness.
**Manual (user):** none.

## Notes

Respawn uses the shared RNG (STORY-01/02). Depends on STORY-03.
