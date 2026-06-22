---
id: STORY-01
epic: EPIC-22
title: Kills window (pop chart)
status: todo
---

## Goal

Render the **kills window** (the "pop chart") — the right-hand panel that shows one
dead face for every player/drone the local player has killed. It is currently blank in
the web build (only the static dashboard shows through), reported during ST testing.
Faithful to `popchart.c` / `add_one_smily`.

## Behaviour (from the original)

- **Window**: `popchart_wind_offset` (`rungame.c:48`) — color rez `X:185 Y:66 W:121 H:37`
  in the 320×200 framebuffer. (Verify against our `main-screen.png` kills panel and
  pixel-tune; the original offset is planar so the comment's X is approximate.)
- **One face per kill**, laid out in **two rows of five** (max 10), filled top-left →
  bottom-right. For kill `k` (the shooter's score, 1..10), window-relative:
  `y = (k <= 5) ? 16 : 33`, `x = ((k - 1) % 5) * 25 + 1`.
- **Each face** = the small ball/body shape (`size 16` ≈ 13 px high) in the **killed**
  player's *back* colour, the face shape in its *frame* colour, then a red **"buster" X**
  over it (`smileybuster_img`, `moreshap.c` — 15 lines × ~17 px; or draw two red
  diagonals as a stand-in).
- **Cleared** at game start (`maingame.c:178`).

## Tasks

- [ ] Track kills in order: the local player's `ply_score` is the count; the victim is
      `ply_looser` at the moment the score increments (`add_one_smily(currentScore,
      ply_looser)`, `maingame.c:339`). Keep an ordered `kills: number[]` (killed player
      indices) for the camera player, reset on a new game. Pure + unit-tested.
- [ ] An arbitrary-position face blit: `drawShape` is locked to the 3D-view horizon, so
      add a helper that blits the `BALL`/`FACE` shape tables (size 16) via `blitMask` at
      a given `(x, y)` in a player's colours.
- [ ] The red buster overlay: extract `smileybuster_img` (or draw two red diagonals).
- [ ] `drawKillsWindow(ctx, world, cameraIndex, kills)` in `render/hud.ts`: draw each
      kill's face at the two-row layout, offset to the kills-window origin; call it from
      the main render path (next to `drawScoreboard` / `drawHappyIndicator`).

## Acceptance

**Automated:** the kill-tracking helper is unit-tested (score increments → ordered
victims); build/lint green.
**Manual (user):** as you kill drones/players the dead faces fill the right-hand panel in
the original's order/colours, and clear on a new game — matching the ST.

## Notes

Reference `popchart.c`, `moreshap.c` (`smileybuster_img`), `rungame.c:48`, `maingame.c:
178/339`. The score noteboard and win/lose tongue/blink animations are the other EPIC-22
stories (authored separately).
