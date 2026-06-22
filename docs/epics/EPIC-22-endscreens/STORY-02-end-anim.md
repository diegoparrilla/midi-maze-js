---
id: STORY-02
epic: EPIC-22
title: Win/lose end-screen animations
status: done
---

## Goal

Animate the game-over screen faithfully to `endshape.c` / `maingame.c:496-590`: the
winner's face **turns around** if you won (or **shakes** twice if you lost), then the
winner **blinks** (eye-lashes flash) or the loser is shown a red **tongue**.

## Tasks

- [x] Winner/loser face animation: drive `drawShape`'s sprite (face direction 0..19)
      from `winner_anim` (turn-around) / `lose_anim` (shake), paced ~2 ticks/frame off
      the game-over timer. Team-aware win check (`ply_team`).
- [x] End decorations (`render/shapes.ts`): `drawWinLashes` (blinzshape, winner's frame
      colour) and `drawLoseTongue` (loosershape, red), view-relative at the original
      (82,43) / (71,72), from the original bitmaps.
- [x] After the turn: the winner blinks (lashes flash ~every 0.8s); the loser keeps the
      tongue. Team-aware result text ("Your team wins/loses!").
- [x] Net path: count the game-over timer down so the animation advances on every node.

## Acceptance

**Automated:** build/lint green; 127 tests pass.
**Manual (user):** on game over the winner's face turns + blinks (you win) or shakes +
sticks its tongue out (you lose), matching the ST.

## Notes

Reuses `drawShape` (EPIC-06/07) for the spinning face; the blinz/looser bitmaps are
taken from `endshape.c` (not bit-flipped — `init_end_shape` only doubles for mono).
