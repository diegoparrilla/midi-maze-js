// HUD overlay (maingame.c crosshair, happyind.c health face, notebrd.c score).
// Drawn at the colour-mode HUD window positions. Visual only (no golden vectors).
import ballRaw from '../assets/generated/ball-shapes.json';
import faceRaw from '../assets/generated/face-shapes.json';
import paletteRaw from '../assets/generated/palette.json';
import type { World } from '../sim/world';
import { blitRuns } from './blit';
import { VIEW_SCREEN_X, VIEW_SCREEN_Y } from './projection';

interface Shape {
  scale: number;
  height: number;
  widthWords: number;
  rows: number[];
}
const PAL = (paletteRaw as { ste: number; rgb: [number, number, number] }[]).map(
  ({ rgb }) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
);
const BALL = ballRaw as Shape[];
const FACE = faceRaw as Shape[][];

// Per-player colours (maingame.c color_ply_back / color_ply_frame).
const COLOR_PLY_BACK = [8, 3, 9, 13, 11, 12, 10, 15, 8, 3, 9, 13, 11, 12, 10, 15];
const COLOR_PLY_FRAME = [0, 0, 0, 0, 0, 0, 0, 0, 10, 11, 10, 11, 10, 10, 11, 10];
const COLOR_WHITE = 15;
const COLOR_RED = 14;

// Happy-indicator faces (happyind.c, inline): 20 rows x 2 words. Index by 3-lives.
const HQUOT_FACES = [
  // 3 lives: happy
  [
    0x00ff, 0x0000, 0x0300, 0xc000, 0x0c00, 0x3000, 0x1181, 0x8800, 0x23c3, 0xc400, 0x43c3, 0xc200,
    0x43c3, 0xc200, 0x83c3, 0xc100, 0x83c3, 0xc100, 0x8181, 0x8100, 0x8000, 0x0100, 0x9800, 0x1900,
    0x8c00, 0x3100, 0x4600, 0x6200, 0x4381, 0xc200, 0x20ff, 0x0400, 0x1000, 0x0800, 0x0c00, 0x3000,
    0x0300, 0xc000, 0x00ff, 0x0000,
  ],
  // 2 lives: ok
  [
    0x00ff, 0x0000, 0x0300, 0xc000, 0x0c00, 0x3000, 0x1181, 0x8800, 0x23c3, 0xc400, 0x43c3, 0xc200,
    0x43c3, 0xc200, 0x83c3, 0xc100, 0x83c3, 0xc100, 0x8181, 0x8100, 0x8000, 0x0100, 0x8000, 0x0100,
    0x8000, 0x0100, 0x43ff, 0xc200, 0x4400, 0x2200, 0x2000, 0x0400, 0x1000, 0x0800, 0x0c00, 0x3000,
    0x0300, 0xc000, 0x00ff, 0x0000,
  ],
  // 1 life: hurt
  [
    0x00ff, 0x0000, 0x0300, 0xc000, 0x0c00, 0x3000, 0x1181, 0x8800, 0x23c3, 0xc400, 0x43c3, 0xc200,
    0x43c3, 0xc200, 0x83c3, 0xc100, 0x83c3, 0xc100, 0x8181, 0x8100, 0x8000, 0x0100, 0x8000, 0x0100,
    0x8000, 0x0100, 0x407e, 0x0200, 0x4181, 0x8200, 0x2200, 0x4400, 0x1000, 0x0800, 0x0c00, 0x3000,
    0x0300, 0xc000, 0x00ff, 0x0000,
  ],
  // 0 lives: sick
  [
    0x00ff, 0x0000, 0x0300, 0xc000, 0x0c00, 0x3000, 0x1000, 0x0800, 0x2281, 0x4400, 0x4100, 0x8200,
    0x4281, 0x4200, 0x8400, 0x2100, 0x8000, 0x0100, 0x8000, 0x0100, 0x8000, 0x0100, 0x807f, 0x0100,
    0x8180, 0xc100, 0x4200, 0x2200, 0x4000, 0x0200, 0x2000, 0x0400, 0x1000, 0x0800, 0x0c00, 0x3000,
    0x0300, 0xc000, 0x00ff, 0x0000,
  ],
];
const HQUOT_TONGUE = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x007f, 0x0000, 0x007f,
  0x0000, 0x003e, 0x0000, 0x001c, 0x0000, 0, 0, 0, 0, 0, 0, 0, 0,
];
const HQUOT_W = 2;
const HQUOT_H = 20;
const HAPPY_X = 128;
const HAPPY_Y = 16;
const SCORE_X = 192;
const SCORE_Y = 10;
// Kills window / pop chart (popchart.c; rungame.c:48 → color-rez window at X:192 Y:66,
// W:121 H:37). It holds a boot splash in our dashboard, so we clear it like the original
// (maingame.c:178). Small dead-face shape index 16 (≈13px). Coords are pixel-tunable.
const KILLS_X = 192;
const KILLS_Y = 66;
const KILLS_W = 121;
const KILLS_H = 37;
const KILLS_SHAPE = 16;
const COLOR_BLACK = 0;
// "Forbidden" symbol drawn red over each killed face (smileybuster_img, moreshap.c,
// after flip_crossedsmil_img): 15 rows × 2 words (≈18px wide). A circle with a slash.
const SMILEYBUSTER = [
  0x03f0, 0x0000, 0x0ffc, 0x0000, 0x3e1f, 0x0000, 0x7803, 0x8000, 0x6c01, 0x8000, 0xc600, 0xc000,
  0xc380, 0xc000, 0xc1c0, 0xc000, 0xc0e0, 0xc000, 0xc070, 0xc000, 0x6031, 0x8000, 0x701f, 0x8000,
  0x3c0f, 0x0000, 0x0ffc, 0x0000, 0x03f0, 0x0000,
];

function vline(ctx: CanvasRenderingContext2D, y1: number, y2: number, x: number): void {
  ctx.fillRect(VIEW_SCREEN_X + x, VIEW_SCREEN_Y + y1, 1, y2 - y1 + 1);
}

/** Blit a 1bpp mask (row-major 16-bit words, MSB = leftmost) in a solid colour,
 *  top-left at absolute screen (sx, sy), run-length batched (EPIC-23). */
function blitMask(
  ctx: CanvasRenderingContext2D,
  rows: number[],
  widthWords: number,
  height: number,
  sx: number,
  sy: number,
  color: number,
): void {
  ctx.fillStyle = PAL[color]!;
  blitRuns(ctx, rows, 0, widthWords, height, sx, sy);
}

/** Firing crosshair (maingame.c), shown when reloaded, in the player's own colour. */
export function drawCrosshair(ctx: CanvasRenderingContext2D, playerIndex: number): void {
  ctx.fillStyle = PAL[COLOR_PLY_BACK[playerIndex & 15]!]!;
  vline(ctx, 50, 51, 78);
  vline(ctx, 50, 51, 80);
  vline(ctx, 49, 49, 79);
  vline(ctx, 52, 52, 79);
}

/** Happy indicator (happyind.c): the player's head with a face by health, tongue when dead. */
export function drawHappyIndicator(
  ctx: CanvasRenderingContext2D,
  world: World,
  ownIndex: number,
): void {
  const p = world.players[ownIndex]!;
  const lives = Math.max(0, Math.min(3, p.ply_lives));
  const head = BALL[12]!; // shape index 12 == 20 lines, 2 words (matches HQUOT)
  blitMask(ctx, head.rows, HQUOT_W, HQUOT_H, HAPPY_X, HAPPY_Y, COLOR_PLY_BACK[ownIndex & 15]!);
  blitMask(
    ctx,
    HQUOT_FACES[3 - lives]!,
    HQUOT_W,
    HQUOT_H,
    HAPPY_X,
    HAPPY_Y,
    COLOR_PLY_FRAME[ownIndex & 15]!,
  );
  if (lives === 0) {
    blitMask(ctx, HQUOT_TONGUE, HQUOT_W, HQUOT_H, HAPPY_X, HAPPY_Y, COLOR_RED);
  }
}

/** Score noteboard (notebrd.c): each player's kills as a note head climbing the
 *  staff, in the player's colour, with a ledger line on odd scores. */
export function drawScoreboard(ctx: CanvasRenderingContext2D, world: World): void {
  for (let i = 0; i < world.playerAndDroneCount; i++) {
    const score = world.players[i]!.ply_score;
    if (score < 0) continue;
    const x = i * 7 + 4;
    const y = 35 - score * 3;
    if (score & 1) {
      ctx.fillStyle = PAL[COLOR_WHITE]!;
      ctx.fillRect(SCORE_X + x, SCORE_Y + y - 2, 5, 1); // ledger line
    }
    ctx.fillStyle = PAL[COLOR_PLY_BACK[i & 15]!]!;
    ctx.fillRect(SCORE_X + x, SCORE_Y + y - 3, 4, 4); // note head
  }
}

/**
 * Kills window / pop chart (popchart.c `add_one_smily`): the window is cleared, then one
 * dead face per kill the local player scored — the killed player's body (back colour) +
 * face (frame colour) with the red "forbidden" symbol (smileybuster) over it. Two rows of
 * five (max 10), filled top-left → bottom-right; `victims[k]` is the player killed for k+1.
 */
export function drawKillsWindow(ctx: CanvasRenderingContext2D, victims: number[]): void {
  // Clear the window first — our dashboard art has a boot splash here (maingame.c:178).
  ctx.fillStyle = PAL[COLOR_BLACK]!;
  ctx.fillRect(KILLS_X, KILLS_Y, KILLS_W, KILLS_H);

  const ball = BALL[KILLS_SHAPE]!;
  const face = FACE[KILLS_SHAPE]![0]!;
  const ww = ball.widthWords;
  const h = ball.height;
  const n = Math.min(victims.length, 10);
  for (let k = 0; k < n; k++) {
    const victim = victims[k]! & 15;
    const x = KILLS_X + 1 + (k % 5) * 25; // two rows of five, left→right
    const y = KILLS_Y + (k < 5 ? 3 : 19);
    blitMask(ctx, ball.rows, ww, h, x, y, COLOR_PLY_BACK[victim]!);
    blitMask(ctx, face.rows, ww, h, x, y, COLOR_PLY_FRAME[victim]!);
    blitMask(ctx, SMILEYBUSTER, 2, 15, x - 1, y - 1, COLOR_RED); // forbidden symbol, centred (15px over 13px)
  }
}
